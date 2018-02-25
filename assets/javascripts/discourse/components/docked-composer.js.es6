import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { headerHeight } from 'discourse/components/site-header';
import { getCurrentUserMessages } from '../lib/user-messages';
import { emojiUnescape } from 'discourse/lib/text';
import { dockedScreenTrack } from '../lib/docked-screen-track';
import { getOwner } from 'discourse-common/lib/get-owner';
import DiscourseURL from 'discourse/lib/url';

const _create_serializer = {
        raw: 'reply',
        title: 'title',
        topic_id: 'topic.id',
        archetype: 'archetypeId',
        target_usernames: 'targetUsernames',
      };

export default Ember.Component.extend({
  tagName: "div",
  classNameBindings: [':docked-composer', 'composeState'],
  isUploading: false,
  disableSubmit: Ember.computed.or("loadingStream", "isUploading"),
  composerMinimized: Ember.computed.equal('composeState', 'minimized'),
  composerReady: Ember.computed.equal('composeState', 'open'),
  postStream: Ember.computed.alias('topic.postStream'),
  loadingStream: false,
  composeState: null,
  targetUsernames: null,
  firstPost: false,
  archetypeId: 'private_message',
  reply: '',
  topic: null,
  emojiPickerOpen: false,

  @on('init')
  setTopic() {
    const id = this.get('id');
    if (id === 'new') {
      this.set('firstPost', true);
      return false;
    }
    this.set('topic', this.getTopic(id));
    this.subscribeToTopic();

    this.appEvents.on('composer:opened', () => this.collapse());
  },

  getTopic(id) {
    const store = getOwner(this).lookup('store:main');
    return store.createRecord('topic', { id });
  },

  subscribeToTopic() {
    const topic = this.get('topic');
    if (!topic) { return; }

    const postStream = topic.get('postStream');
    const row = {
            topic_id: topic.id,
            highest_post_number: topic.highest_post_number,
            last_read_post_number: Math.min(topic.highest_post_number, topic.last_read_post_number),
            created_at: topic.created_at,
            category_id: topic.category_id,
            notification_level: topic.notification_level
          };
    const states = { 't#{topic.id}': row };

    getOwner(this).lookup('topic-tracking-state:main').loadStates(states);

    this.messageBus.subscribe("/topic/" + topic.id, data => {
      if (data.type === "created") {
        postStream.triggerNewPostInStream(data.id).then(() => this.afterStreamRender());
        if (this.get('currentUser.id') !== data.user_id) {
          Discourse.notifyBackgroundCountIncrement();
        }
      }
    });
  },

  @observes('topic.postStream.hasLoadedData')
  afterStreamRender() {
    const postStream = this.get('postStream');
    if (postStream) {
      postStream.refresh({ nearPost: this.get("topic.highest_post_number") }).then(() => {
        Ember.run.scheduleOnce('afterRender', this, () => {
          if (this.$()) {
            this.$('.docked-composer-top').scrollTop(this.$('.docked-post-stream').height());
            dockedScreenTrack(this, this.get('topic'));
          }
        });
      });
    }
  },

  @on('didInsertElement')
  _setupDisplay() {
    this.set('composeState', 'open');
    const $replyControl = this.$();
    const resize = () => Ember.run.scheduleOnce('afterRender', () => this._resize());
    $replyControl.DivResizer({
      resize,
      maxHeight: winHeight => winHeight - headerHeight(),
      onDrag: sizePx => this.movePanels(sizePx)
    });
  },

  @on('didInsertElement')
  @observes('index')
  _arrangeComposers() {
    Ember.run.scheduleOnce('afterRender', () => {
      const index = this.get('index');
      let right = 340 * index + 100;
      this.$().css('right', right);
    });
  },

  @observes('composeState')
  _resize() {
    const h = this.$() ? this.$().height() : 0;
    this.movePanels(h + "px");
  },

  movePanels(sizePx) {
    $('#main-outlet').css('padding-bottom', sizePx);
  },

  @computed('targetUsernames', 'missingReplyCharacters')
  cantSubmitPost() {
    if (this.get('replyLength') < 1) return true;
    return this.get('targetUsernames') && (this.get('targetUsernames').trim() + ',').indexOf(',') === 0;
  },

  @computed('reply')
  replyLength() {
    let reply = this.get('reply') || "";
    return reply.replace(/\s+/img, " ").trim().length;
  },

  save() {
    if (this.get('cantSubmitPost')) return;

    let imageSizes = {};
    this.$('.docked-editor img').each((i, e) => {
      const $img = $(e);
      const src = $img.prop('src');
      if (src && src.length) {
        imageSizes[src] = { width: $img.width(), height: $img.height() };
      }
    });

    const store = getOwner(this).lookup('store:main');
    const postStream = this.get('postStream');
    const user = this.get('currentUser');

    let createdPost = store.createRecord('post', {
          cooked: emojiUnescape(this.get('reply')),
          yours: true
        });
    let postOpts = {
          custom_fields: { 'quick_message': true },
          imageSizes
        };

    this.serialize(_create_serializer, postOpts);
    this.set('reply', '');

    let state = '';
    if (postStream) {
      state = postStream.stagePost(createdPost, user);
      this.set('firstPost', false);
    }
    if (state === 'staged') this.afterStreamRender();

    const self = this;
    const id = this.get('id');
    createdPost.save(postOpts).then((result) => {
      if (postStream) {
        user.set('reply_count', user.get('reply_count') + 1);
        postStream.commitPost(createdPost);
      }

      if (!id || id === 'new') {
        self.set('firstPost', false);
        self.sendAction('updateId', self.get('index'), result.responseJson.post.topic_id);

        if (id === 'new') {
          user.set('topic_count', user.get('topic_count') + 1);
        }
      }
    }).catch(function(error) {
      bootbox.alert(error.jqXHR.responseJSON.errors[0]);
    });
  },

  serialize(serializer, dest) {
    dest = dest || {};
    Object.keys(serializer).forEach(f => {
      const val = this.get(serializer[f]);
      if (typeof val !== 'undefined') {
        Ember.set(dest, f, val);
      }
    });
    return dest;
  },

  actions: {
    save() {
      this.save();
    },

    cancel() {
      this.cancel();
    },

    toggle() {
      this.toggle();
    },

    openTopic() {
      const topicUrl = this.get('topic.url');
      this.cancel();
      DiscourseURL.routeTo(topicUrl);
    },

    showUsernames() {
      this.toggleProperty('showUsernames');
    },

    toggleEmojiPicker(state) {
      if (state) {
        this.set('emojiPickerOpen', state);
      } else {
        this.toggleProperty('emojiPickerOpen');
      }

      if (this.get('emojiPickerOpen')) {
        Ember.run.next(() => {
          const composerWidth = 300;
          const emojiModalWidth = 400;
          const composerOffset = this.$().offset();
          const composerLeftOffset = composerOffset.left;

          let css = { bottom: 20, visibility: 'visible' };

          if (composerLeftOffset > emojiModalWidth) {
            css['left'] = composerLeftOffset - emojiModalWidth;
          } else if (($(window).width() - (composerLeftOffset - composerWidth)) > emojiModalWidth) {
            css['left'] = composerLeftOffset + composerWidth;
          } else {
            css['left'] = composerLeftOffset;
            css['bottom'] = this.$().height();
          }

          $('.emoji-picker').css(css);
        });
      }
    }
  },

  closeAutocomplete() {
    this.$('.d-editor-input').autocomplete({ cancel: true });
  },

  keyDown(e) {
    const enter = e.which === 13;
    const shift = e.shiftKey;
    const escape = e.which === 27;

    if (escape) {
      this.toggle();
      return false;
    }

    if (enter && shift) {
      let reply = this.get('reply');
      reply += '\n';
      this.set('reply', reply);
      return false;
    } else if (enter) {
      this.save();
      return false;
    }
  },

  open() {
    this.set('composeState', 'open');
    this.$().animate({ height: 400 }, 300, () => {
      this.afterStreamRender();
    });
  },

  collapse() {
    this.set('composeState', 'minimized');
    this.$().animate({ height: 40 }, 300);
  },

  close() {
    this.set('composeState', 'closed');
    this.$().animate({ height: 0 }, 300, () => {
      this.sendAction('removeDocked', this.get('index'));
    });
  },

  cancel() {
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

  toggle() {
    this.closeAutocomplete();
    switch (this.get('composeState')) {
      case 'open':
        this.collapse();
        break;
      case 'minimized':
        this.open();
        break;
    }
    return false;
  },

  @computed('composeState')
  togglerIcon(composeState) {
    return composeState === 'minimized' ? 'fa-angle-up' : 'fa-angle-down';
  },

  getUsernames(participants) {
    let usernames = [];
    participants.forEach((participant) => {
      let username = participant.user ? participant.user.username : participant.username;
      usernames.push(username);
    });
    return usernames;
  },

  formatUsernames(usernames) {
    let formatted = '';
    let length = usernames.length;
    usernames.forEach((username, i) => {
      formatted += username;
      if (i < length - 1) {
        formatted += i === (length - 2) ? ' & ' : ', ';
      }
    });
    return formatted;
  },

  @computed('topic.details.loaded')
  otherUsernames(loaded) {
    if (loaded) {
      const usernames = this.getUsernames(this.get('topic.details.allowed_users'));
      usernames.splice(usernames.indexOf(this.get('currentUser.username')), 1);
      return this.formatUsernames(usernames);
    }
    return '';
  },

  @on('didInsertElement')
  @observes('otherUsernames')
  handleLongUsernames() {
    if (this.get('otherUsernames')) {
      Ember.run.scheduleOnce('afterRender', this, () => {
        if (this.$(".docked-usernames").width() > 200) {
          this.set("hiddenUsernames", true);
        }
      });
    }
  },

  @observes('targetUsernames')
  createOrContinue() {
    const currentUsername = this.get('currentUser.username');
    let existingId = null;
    let targetUsernames = this.get('targetUsernames').split(',');
    targetUsernames.push(currentUsername);

    getCurrentUserMessages(this).then((result) => {
      result.forEach((message) => {
        let usernames = this.getUsernames(message.participants);
        if (usernames.indexOf(currentUsername) === -1) {
          usernames.push(currentUsername);
        }

        if (_.isEqual(_.sortBy(usernames), _.sortBy(targetUsernames))) {
          existingId = message.id;
        }
      });

      if (existingId) {
        const docked = this.get('docked');
        let index = docked.indexOf(existingId);
        if (index > -1) {
          this.set('disableEditor', true);
        } else {
          this.setProperties({
            'topic': this.getTopic(existingId),
            'disableEditor': false
          });
          this.subscribeToTopic();
        }
      } else {
        this.setProperties({
          'id': 'new',
          'topic': null,
          'title': this.formatUsernames(targetUsernames),
          'disableEditor': false
        });
      }
    });
  }
});
