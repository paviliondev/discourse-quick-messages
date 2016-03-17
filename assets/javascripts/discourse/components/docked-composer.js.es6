import afterTransition from 'discourse/lib/after-transition';
import { headerHeight } from 'discourse/views/header';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import Topic from 'discourse/models/topic';
import autosize from 'admin/lib/autosize';

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
  composeState: null,
  viewOpen: Ember.computed.equal('composeState', 'open'),
  saveIcon: '<i class="fa fa-reply"></i>',

  right: function() {
    var index = this.get('index'),
        right = 340 * index + 100;
    this.$().css('right', right)
  }.observes('index').on('didInsertElement'),

  didInsertElement: function(opts) {
    Ember.run.scheduleOnce('afterRender', () => {
      autosize(this.$('.d-editor-input'));
    });
    const $replyControl = this.$();
    const resize = () => Ember.run.scheduleOnce('afterRender', () => {this.resize()});
    $replyControl.DivResizer({
      resize,
      maxHeight: winHeight => winHeight - headerHeight(),
      onDrag: sizePx => this.movePanels(sizePx)
    });
    this.set('composeState', 'open')
    this.messageBus.subscribe("/topic/" + this.get('topic.id'), data => {
      if (data.type === "created") {
        Topic.find(data.topic_id, {}).then((topic) => {
          var topic = Topic.create(topic)
          self.set('topic', topic)
        })
      }
    })
  },

  @observes('reply')
  _updateAutosize() {
    const evt = document.createEvent('Event'),
          ele = this.$('.d-editor-input')[0];
    evt.initEvent('autosize:update', true, false);
    console.log('dispatching event', this.get('reply'))
    ele.dispatchEvent(evt);
  },

  @observes('composeState')
  resize() {
    const h = this.$().height() || 0;
    this.movePanels(h + "px");
  },

  movePanels: function(sizePx) {
    $('#main-outlet').css('padding-bottom', sizePx);
    this.appEvents.trigger("composer:resized");
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
      this.dockedToggle()
      return false;
    }
    if (enter && shift) {
      var reply = this.get('reply')
      reply += '\n'
      this.set('reply', reply)
      return false;
    } else if (enter) {
      this.dockedSave()
      return false;
    }
  },

  click: function() {
    this.set('composeState', 'open');
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

  actions: {
    save() {
      this.dockedSave()
    },
    cancel() {
      this.dockedCancel()
    },
    toggle() {
      this.dockedToggle()
    },
  },

  dockedSave: function() {
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

    const topic = this.get('topic'),
          user = this.get('currentUser'),
          postStream = this.get('topic.postStream'),
          store = this.container.lookup('store:main');

    let addedToStream = false;

    // Build the post object
    const createdPost = store.createRecord('post', {
      imageSizes: imageSizes,
      cooked: this.getCookedHtml(),
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
      typingTime: this.get('typingTime'),
      composerTime: this.get('composerTime')
    });

    this.set('reply', '')
    this.$('.d-editor-input').css('height', 'auto')

    var dest = createdPost || {},
        serializer = _create_serializer;
    Object.keys(serializer).forEach(f => {
      const val = this.get(serializer[f]);
      if (typeof val !== 'undefined') {
        Ember.set(dest, f, val);
      }
    });

    const self = this;

    createdPost.save().then(function(result) {
      var response = result.responseJson
      if (topic) {
        user.set('reply_count', user.get('reply_count') + 1);
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
      self.appEvents.one('composer:opened', () => bootbox.alert(error));
    });
  },

  dockedCancel: function() {
    this.set('composeState', 'closed')
    this.cancelComposer()
  },

  dockedToggle: function() {
    if (Ember.isEmpty(this.get('reply'))) {
      this.dockedCancel()
    } else {
      this.closeAutocomplete();
      switch (this.get('composeState')) {
        case 'open':
          if (Ember.isEmpty(this.get('reply'))) {
            this.close();
          } else {
            this.shrink();
          }
          break;
        case 'minimized':
          this.set('composeState', 'open');
          break;
        case 'saving':
          this.close();
      }
      return false;
    }
  },

  @computed('composeState')
  dockedDraft() {
    if (this.get('composeState') === 'minimized') {
      var participants = this.get('topic').details.allowed_users,
          usernames = this.getUsernames(participants);
      usernames.splice(usernames.indexOf(this.get('currentUser.username')), 1)
      return this.formatUsernames(usernames);
    } else {
      return false
    }
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

  cancelComposer: function() {
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

  @computed('loading', 'targetUsernames', 'missingReplyCharacters')
  cantSubmitPost() {
    if (this.get('loading')) return true;
    if (this.get('replyLength') < 1) return true;
    return this.get('targetUsernames') && (this.get('targetUsernames').trim() + ',').indexOf(',') === 0;
  },

  getCookedHtml: function() {
    return this.$('.d-editor').html().replace(/<span class="marker"><\/span>/g, '');
  },

  @computed('reply')
  replyLength() {
    let reply = this.get('reply') || "";
    return reply.replace(/\s+/img, " ").trim().length;
  },

  @on('willDestroyElement')
  _disableAutosize() {
    autosize.destroy(this.$('.d-editor-input'));
  }

})
