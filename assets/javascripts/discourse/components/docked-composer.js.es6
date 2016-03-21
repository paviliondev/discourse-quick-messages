import afterTransition from 'discourse/lib/after-transition';
import { headerHeight } from 'discourse/views/header';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import Topic from 'discourse/models/topic';
import autosize from 'discourse/lib/autosize';

const _create_serializer = {
        raw: 'reply',
        title: 'title',
        category: 'categoryId',
        topic_id: 'topic.id',
        is_warning: 'isWarning',
        whisper: 'whisper',
        archetype: 'archetypeId',
        target_usernames: 'targetUsernames',
        typing_duration_msecs: 'typingTime',
        composer_open_duration_msecs: 'composerTime'
      }

export default Ember.Component.extend({
  tagName: "div",
  classNameBindings: [':docked-composer', 'composeState', 'composer.loading', 'composer.createdPost:created-post'],
  existingDiscussion: null,
  isUploading: false,
  lastValidatedAt: null,
  disableSubmit: Ember.computed.or("loading", "isUploading"),
  composerOpen: Ember.computed.equal('composeState', 'open'),
  composerMinimized: Ember.computed.equal('composeState', 'minimized'),
  composeState: null,

  @on('didInsertElement')
  _setup() {
    this.set('composeState', 'open')
    Ember.run.scheduleOnce('afterRender', () => {
      autosize(this.$('.d-editor-input'));
    });
    ;
    this.$().one("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd", () => {
      switch (this.get('composeState')) {
        case 'closed':
          var index = this.get('index')
          this.sendAction('removeComposer', index)
          break;
        case 'open':
          this.afterPostRender();
          break;
      }
    });

    const $replyControl = this.$(),
          resize = () => Ember.run.scheduleOnce('afterRender', () => {this._resize()});
    $replyControl.DivResizer({
      resize,
      maxHeight: winHeight => winHeight - headerHeight(),
      onDrag: sizePx => this.movePanels(sizePx)
    });

    var topic = this.get('topic'),
        postStream = topic.get('postStream'),
        self = this;
    this.messageBus.subscribe("/topic/" + topic.id, data => {
      if (data.type === "created") {
        postStream.triggerNewPostInStream(data.id).then(() => this.afterPostRender())
        if (this.get('currentUser.id') !== data.user_id) {
          Discourse.notifyBackgroundCountIncrement();
        }
      }
    })
  },

  @on('didInsertElement')
  @observes('index')
  _right() {
    var index = this.get('index'),
        right = 340 * index + 100;
    this.$().css('right', right)
  },

  @on('willDestroyElement')
  _tearDown() {
    autosize.destroy(this.$('.d-editor-input'));
    this.$().unbind("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd")
  },

  @observes('reply')
  _updateAutosize() {
    const evt = document.createEvent('Event'),
          ele = this.$('.d-editor-input')[0];
    evt.initEvent('autosize:update', true, false);
    ele.dispatchEvent(evt);
  },

  @observes('composeState')
  _resize() {
    const h = this.$().height() || 0;
    this.movePanels(h + "px");
  },

  movePanels: function(sizePx) {
    $('#main-outlet').css('padding-bottom', sizePx);
  },

  topic: function() {
    const store = this.container.lookup('store:main')
    return store.createRecord('topic', {id: this.get('topicId')})
  }.property(),

  postStream: function() {
    var topic = this.get('topic'),
        postStream = topic.get('postStream');
    postStream.refresh({nearPost: topic.highest_post_number}).then(() => {
      this.afterPostRender()
    })
    return postStream
  }.property('topic'),

  afterPostRender: function() {
    Ember.run.schedule('afterRender', () => {
      this.$('.composer-fields').scrollTop($('.docked-post-stream').height())
      this.dockedScreenTrack()
    })
  },

  dockedScreenTrack: function() {
    var topic = this.get('topic'),
        lastRead = topic.last_read_post_number,
        highest = topic.highest_post_number;
    if (lastRead === highest) {return}
    this.container.lookup('topic-tracking-state:main').updateSeen(topic.id, highest)
    var newTimings = {};
    for (var p = lastRead + 1; p <= highest; p++) {
      newTimings[p] = 3000
    }
    Discourse.ajax('/topics/timings', {
      data: {
        timings: newTimings,
        topic_time: 3000,
        topic_id: topic.id
      },
      cache: false,
      type: 'POST',
      headers: {
        'X-SILENCE-LOGGER': 'true'
      }
    })
  },

  save: function() {
    if (this.get('cantSubmitPost')) {
      this.set('lastValidatedAt', Date.now());
      return;
    }

    var staged = false;
    const imageSizes = {};
    this.$('.d-editor img').each((i, e) => {
      const $img = $(e);
      const src = $img.prop('src');
      if (src && src.length) {
        imageSizes[src] = { width: $img.width(), height: $img.height() };
      }
    });

    var topic = this.get('topic'),
        user = this.get('currentUser'),
        store = this.container.lookup('store:main'),
        postStream = this.get('postStream');

    // Build the post object
    var createdPost = store.createRecord('post', {
      imageSizes: imageSizes,
      cooked: this.get('reply'),
      reply_count: 0,
      name: user.get('name'),
      display_username: user.get('name'),
      username: user.get('username'),
      user_id: user.get('id'),
      user_title: user.get('title'),
      avatar_template: user.get('avatar_template'),
      user_custom_fields: user.get('custom_fields'),
      post_type: this.site.get('post_types').regular,
      actions_summary: [],
      moderator: user.get('moderator'),
      admin: user.get('admin'),
      yours: true,
      read: true,
      wiki: false,
    });

    this.serialize(_create_serializer, createdPost)

    this.$('.d-editor-input').css('height', 'auto')
    this.set('reply', '')

    if (postStream) {
      var state = postStream.stagePost(createdPost, user);
    }

    if (state === 'staged') {this.afterPostRender()}

    const self = this;
    createdPost.save().then(function(result) {
      if (topic) {
        user.set('reply_count', user.get('reply_count') + 1);
        postStream.commitPost(createdPost)
      } else {
        user.set('topic_count', user.get('topic_count') + 1);
        const category = self.site.get('categories').find(function(x) {
          return x.get('id') === (parseInt(createdPost.get('category'),10) || 1);
        });
        if (category) category.incrementProperty('topic_count');
        Discourse.notifyPropertyChange('globalNotice');
      }
    }).catch(function(error) {
      console.log(error)
      bootbox.alert(error)
    });
  },

  serialize: function(serializer, dest) {
    dest = dest || {};
    Object.keys(serializer).forEach(f => {
      const val = this.get(serializer[f]);
      if (typeof val !== 'undefined') {
        Ember.set(dest, f, val);
      }
    });
    return dest;
  },

  @computed('composeState')
  draft() {
    if (this.get('composerMinimized')) {
      var topic = this.get('topic')
      var participants = topic.get('details').allowed_users,
          usernames = this.getUsernames(participants);
      usernames.splice(usernames.indexOf(this.get('currentUser.username')), 1)
      return this.formatUsernames(usernames);
    } else {
      return false
    }
  },

  actions: {
    save() {
      this.save()
    },
    cancel() {
      this.cancel()
    },
    toggle() {
      this.toggle()
    },
    open() {
      this.set('composeState', 'open')
    },
    showQuickUpload(e) {
      this.sendAction('showQuickUpload', e);
    }
  },

  closeAutocomplete: function() {
    this.$('.d-editor-input').autocomplete({ cancel: true });
  },

  keyDown: function(e) {
    var enter = Boolean(e.which === 13),
        shift = Boolean(e.shiftKey),
        escape = Boolean(e.which === 27),
        ctrlCmd = Boolean(e.ctrlKey || e.metaKey);
    if (escape) {
      this.toggle()
      return false;
    }
    if (enter && shift) {
      var reply = this.get('reply')
      reply += '\n'
      this.set('reply', reply)
      return false;
    } else if (enter) {
      this.save()
      return false;
    }
  },

  shrink: function() {
    if (this.get('reply')) {
      this.collapse();
    } else {
      this.close();
    }
  },

  collapse: function() {
    this.set('composeState', 'minimized')
  },

  close: function() {
    this.set('lastValidatedAt', null)
    this.set('composeState', 'closed')
  },

  cancel: function() {
    const self = this;
    return new Ember.RSVP.Promise(function (resolve) {
      if (self.get('reply')) {
        bootbox.confirm(I18n.t("post.abandon.confirm"), I18n.t("post.abandon.no_value"),
            I18n.t("post.abandon.yes_value"), function(result) {
          if (result) {
            self.close();
            resolve();
          }
        });
      } else {
        self.close();
        resolve();
      }
    });
  },

  toggle: function() {
    if (Ember.isEmpty(this.get('reply'))) {
      this.cancel()
    } else {
      this.closeAutocomplete();
      switch (this.get('composeState')) {
        case 'open':
          this.shrink();
          break;
        case 'minimized':
          this.set('composeState', 'open');
          break;
      }
      return false;
    }
  },

  togglerIcon: function() {
    return this.get('composeState') === 'minimized' ? 'fa-angle-up' : 'fa-angle-down'
  }.property('composeState'),

  getUsernames: function(participants) {
    var usernames = []
    participants.forEach((participant, i) => {
      var username = participant.user ? participant.user.username : participant.username
      usernames.push(username)
    })
    return usernames
  },

  formatUsernames: function(usernames) {
    var formatted = '',
        length = usernames.length;
    usernames.forEach((username, i) => {
      formatted += username
      if (i < length - 1) {
        formatted += i === (length - 2) ? ' & ' : ', '
      }
    })
    return formatted
  },

  @observes('targetUsernames')
  createOrContinueDiscussion() {
    var targetUsernames = this.get('targetUsernames')
    if (!targetUsernames) {return}
    var messages = this.get('messages'),
        currentUser = this.get('currentUser.username'),
        existingId = null,
        targetUsernames = targetUsernames.split(',');
    targetUsernames.push(currentUser)
    messages.forEach((message, i) => {
      var usernames = this.getUsernames(message.participants)
      if (usernames.indexOf(currentUser) === -1) {
        usernames.push(currentUser)
      }
      if ($(usernames).not(targetUsernames).length === 0 &&
         $(targetUsernames).not(usernames).length === 0) {
        existingId = message.id;
      }
    })
    if (existingId) {
      Topic.find(existingId, {}).then((topic) => {
        var existing = Topic.create(topic)
        this.set('topic', existing)
      })
    } else {
      this.set('topic', null)
      this.set('title', this.formatUsernames(targetUsernames))
    }
  },

  @computed('loading', 'targetUsernames', 'missingReplyCharacters')
  cantSubmitPost() {
    if (this.get('loading')) return true;
    if (this.get('replyLength') < 1) return true;
    return this.get('targetUsernames') && (this.get('targetUsernames').trim() + ',').indexOf(',') === 0;
  },

  @computed('composer.reply', 'composer.replyLength', 'composer.missingReplyCharacters', 'composer.minimumPostLength', 'lastValidatedAt')
  validation(reply, replyLength, missingReplyCharacters, minimumPostLength, lastValidatedAt) {
    const postType = this.get('composer.post.post_type');
    if (postType === this.site.get('post_types.small_action')) { return; }

    let reason;
    if (replyLength < 1) {
      reason = I18n.t('composer.error.post_missing');
    } else if (missingReplyCharacters > 0) {
      reason = I18n.t('composer.error.post_length', {min: minimumPostLength});
      const tl = Discourse.User.currentProp("trust_level");
      if (tl === 0 || tl === 1) {
        reason += "<br/>" + I18n.t('composer.error.try_like');
      }
    }

    if (reason) {
      return Discourse.InputValidation.create({ failed: true, reason, lastShownAt: lastValidatedAt });
    }
  },

  @computed('reply')
  replyLength() {
    let reply = this.get('reply') || "";
    return reply.replace(/\s+/img, " ").trim().length;
  }

})
