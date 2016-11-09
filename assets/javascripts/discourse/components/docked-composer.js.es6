import afterTransition from 'discourse/lib/after-transition';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { headerHeight } from 'discourse/components/site-header';
import { getCurrentUserMessages } from 'discourse/plugins/discourse-quick-messages/discourse/helpers/user-messages';
import Topic from 'discourse/models/topic';
import autosize from 'discourse/lib/autosize';
import Composer from 'discourse/models/composer';
import { emojiUnescape } from 'discourse/lib/text';
import { ajax } from 'discourse/lib/ajax';

const _create_serializer = {
        raw: 'reply',
        title: 'title',
        topic_id: 'topic.id',
        archetype: 'archetypeId',
        target_usernames: 'targetUsernames',
      }

export default Ember.Component.extend({
  tagName: "div",
  classNameBindings: [':docked-composer', 'composeState', 'composer.loading', 'composer.createdPost:created-post'],
  existingDiscussion: null,
  isUploading: false,
  disableSubmit: Ember.computed.or("loadingStream", "isUploading"),
  composerOpen: Ember.computed.equal('composeState', 'open'),
  composerMinimized: Ember.computed.equal('composeState', 'minimized'),
  loadingStream: false,
  composeState: null,
  targetUsernames: null,
  firstPost: false,
  archetypeId: 'private_message',
  offScreen: false,
  reply: '',

  @on('didInsertElement')
  _setup() {
    Ember.run.scheduleOnce('afterRender', () => {
      autosize(this.$('.d-editor-input'));
    });
    this.$().on("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd", () => {
      switch (this.get('composeState')) {
        case 'closed':
          var index = this.get('index')
          this.sendAction('removeDocked', index)
          break;
        case 'open':
          this.afterStreamRender();
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
    const composeController = this.container.lookup('controller:composer')
    this.set('composeController', composeController)
  },

  @on('didInsertElement')
  @observes('composeController.model.composeState')
  _hideWhenMainComposerIsOpen(){
    if (this.get('composeController.model.composeState') === Composer.OPEN) {
      this.collapse()
    }
  },

  @on('willInsertElement')
  @observes('topic')
  subscribeToTopic() {
    const topic = this.get('topic')
    if (!topic) {return}

    let postStream = topic.get('postStream'),
        self = this,
        row = {
          topic_id: topic.id,
          highest_post_number: topic.highest_post_number,
          last_read_post_number: Math.min(topic.highest_post_number, topic.last_read_post_number),
          created_at: topic.created_at,
          category_id: topic.category_id,
          notification_level: topic.notification_level
        },
        states = {
          't#{topic.id}': row
        };

    this.container.lookup('topic-tracking-state:main').loadStates(states);

    this.messageBus.subscribe("/topic/" + topic.id, data => {
      if (data.type === "created") {
        postStream.triggerNewPostInStream(data.id).then(() => this.afterStreamRender())
        if (this.get('currentUser.id') !== data.user_id) {
          Discourse.notifyBackgroundCountIncrement();
        }
      }
    })
  },

  @on('didInsertElement')
  @observes('index', 'maxIndex')
  _position() {
    const index = this.get('index'),
          docked = this.get('docked'),
          max = this.get('maxIndex');

    if (index > max) {
      this.set('offScreen', true)
      this.collapse()
      var extra = max + 1,
          right = 340 * extra + 100,
          stackIndex = index - extra,
          bottom = stackIndex * 40 + 'px';
    } else {
      var right = 340 * index + 100,
          bottom = 0;
      this.set('composeState', 'open')
    }
    this.$().css({
      'right': right,
      'bottom': bottom,
    })
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

  @computed('id')
  topic() {
    var id = this.get('id');
    if (id === 'new') {
      this.set('firstPost', true)
      return false
    }
    const store = this.container.lookup('store:main')
    return store.createRecord('topic', {id: id})
  },

  @computed('topic')
  postStream() {
    var topic = this.get('topic')
    if (!topic) {return null}
    this.set('loadingStream', true)
    var postStream = topic.get('postStream');
    postStream.refresh({nearPost: topic.highest_post_number}).then(() => {
      this.set('loadingStream', false)
    })
    return postStream
  },

  @on('didInsertElement')
  @observes('loadingStream')
  afterStreamRender: function() {
    if (this.get('loadingStream') != true) {
      Ember.run.scheduleOnce('afterRender', () => {
        if (this.$('.docked-composer')) {
          this.$('.docked-composer-top').scrollTop($('.docked-post-stream').height())
          this.dockedScreenTrack()
        }
      })
    }
  },

  dockedScreenTrack: function() {
    let topic = this.get('topic'),
        highest = topic.highest_post_number,
        lastRead = Math.min(highest, topic.last_read_post_number);

    this.container.lookup('topic-tracking-state:main').updateSeen(topic.id, highest)

    let newTimings = {};
    if (lastRead === highest) {
      newTimings[highest] = 3000
    } else {
      for (let p = lastRead + 1; p <= highest; p++) {
        newTimings[p] = 3000
      }
    }

    ajax('/topics/timings', {
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
      return;
    }

    var staged = false;
    const imageSizes = {};
    this.$('.docked-editor img').each((i, e) => {
      const $img = $(e);
      const src = $img.prop('src');
      if (src && src.length) {
        imageSizes[src] = { width: $img.width(), height: $img.height() };
      }
    });

    var topic = this.get('topic'),
        user = this.get('currentUser'),
        store = this.container.lookup('store:main'),
        postStream = this.get('postStream'),
        createdPost = store.createRecord('post', {
          cooked: emojiUnescape(this.get('reply')),
          yours: true
         }),
        postOpts = { custom_fields: { 'quick_message': true } };

    this.serialize(_create_serializer, postOpts)
    this.set('reply', '')

    Ember.run.scheduleOnce('afterRender', () => { this._updateAutosize() })

    if (postStream) {
      var state = postStream.stagePost(createdPost, user);
      this.set('firstPost', false)
    }

    if (state === 'staged') {this.afterStreamRender()}

    const self = this;
    createdPost.save(postOpts).then(function(result) {
      if (topic) {
        user.set('reply_count', user.get('reply_count') + 1);
        postStream.commitPost(createdPost)
      } else {
        self.set('firstPost', false)
        var id = result.responseJson.post.topic_id
        self.set('id', id)
        self.sendAction('udpatedId', id, self.get('index'))
        user.set('topic_count', user.get('topic_count') + 1);
        const category = self.site.get('categories').find(function(x) {
          return x.get('id') === (parseInt(createdPost.get('category'),10) || 1);
        });
        if (category) category.incrementProperty('topic_count');
        Discourse.notifyPropertyChange('globalNotice');
      }
    }).catch(function(error) {
      console.log(error)
      bootbox.alert(error.jqXHR.responseJSON.errors[0])
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

  @computed('composeState', 'topic.details.loaded')
  draft() {
    if (this.get('composerMinimized')) {
      var topic = this.get('topic')
      if (!topic) {return}
      var details = topic.get('details')
      if (!details.loaded) {return}
      var usernames = this.getUsernames(details.allowed_users);
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
    this.closeAutocomplete();
    switch (this.get('composeState')) {
      case 'open':
        if (Ember.isEmpty(this.get('reply'))) {
          this.cancel()
        } else {
          this.shrink();
        }
        break;
      case 'minimized':
        if (this.get('offScreen')) {
          this.sendAction('onScreen', this.get('index'))
        }
        this.set('composeState', 'open');
        break;
    }
    return false;
  },

  @computed('composeState')
  togglerIcon() {
    return this.get('composeState') === 'minimized' ? 'fa-angle-up' : 'fa-angle-down'
  },

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
  createOrContinue() {
    var targetUsernames = this.get('targetUsernames'),
        currentUser = this.get('currentUser.username'),
        existingId = null,
        targetUsernames = targetUsernames.split(',');
    targetUsernames.push(currentUser)
    getCurrentUserMessages(this).then((result) => {
      result.forEach((message, i) => {
        var usernames = this.getUsernames(message.participants)
        if (usernames.indexOf(currentUser) === -1) {
          usernames.push(currentUser)
        }
        if ($(usernames).not(targetUsernames).length === 0 &&
           $(targetUsernames).not(usernames).length === 0) {
          existingId = this.get('docked').indexOf(message.id) > -1 ? 'docked' : message.id
          return
        }
      })
      if (existingId) {
        if (existingId === 'docked') {
          this.set('id', 'new')
          return
        } else {
          this.set('id', existingId)
        }
      } else {
        this.set('id', 'new')
        this.set('title', this.formatUsernames(targetUsernames))
      }
    })
  },

  @computed('loading', 'targetUsernames', 'missingReplyCharacters')
  cantSubmitPost() {
    if (this.get('loading')) return true;
    if (this.get('replyLength') < 1) return true;
    return this.get('targetUsernames') && (this.get('targetUsernames').trim() + ',').indexOf(',') === 0;
  },

  @computed('reply')
  replyLength() {
    let reply = this.get('reply') || "";
    return reply.replace(/\s+/img, " ").trim().length;
  }

})
