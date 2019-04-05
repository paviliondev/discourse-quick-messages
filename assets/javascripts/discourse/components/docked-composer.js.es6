import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { headerHeight } from 'discourse/components/site-header';
import { getCurrentUserMessages } from '../lib/user-messages';
import { emojiUnescape } from 'discourse/lib/text';
import { dockedScreenTrack } from '../lib/docked-screen-track';
import { getOwner } from 'discourse-common/lib/get-owner';
import DiscourseURL from 'discourse/lib/url';
import { getUsernames, formatUsernames } from '../lib/docked-composer';
import { popupAjaxError } from 'discourse/lib/ajax-error';

const _create_serializer = {
        raw: 'reply',
        title: 'title',
        topic_id: 'topic.id',
        archetype: 'archetypeId',
        target_usernames: 'targetUsernames',
      };

const START_EVENTS = "touchstart mousedown";
const DRAG_EVENTS = "touchmove mousemove";
const END_EVENTS = "touchend mouseup";

const MIN_COMPOSER_SIZE = 240;
const THROTTLE_RATE = 20;

function mouseYPos(e) {
  return e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
}

export default Ember.Component.extend({
  tagName: "div",
  classNameBindings: [':docked-composer', 'composeState'],
  disableSubmit: Ember.computed.or("loading", "uploading"),
  composerOpen: Ember.computed.equal('composeState', 'open'),
  postStream: Ember.computed.alias('topic.postStream'),
  loading: true,
  composeState: null,
  targetUsernames: null,
  firstPost: false,
  archetypeId: 'private_message',
  reply: '',
  topic: null,
  emojiPickerOpen: false,
  hiddenUsernames: false,
  mobileKeyboard: false,

  // display

  @on('didInsertElement')
  _setupDisplay() {
    this.set('composeState', 'open');

    if (!this.site.mobileView) {
      this.setupComposerResizeEvents()
    }
  },

  setupComposerResizeEvents() {
    const $composer = this.$();
    const $grippie = this.$(".docked-composer-header");
    const $document = Ember.$(document);
    let origComposerSize = 0;
    let lastMousePos = 0;

    const performDrag = event => {
      $composer.trigger("div-resizing");
      $composer.addClass("clear-transitions");
      const currentMousePos = mouseYPos(event);
      let size = origComposerSize + (lastMousePos - currentMousePos);

      const winHeight = Ember.$(window).height();
      size = Math.min(size, winHeight - headerHeight());
      size = Math.max(size, MIN_COMPOSER_SIZE);
      const sizePx = `${size}px`;
      this.movePanels(sizePx);
      $composer.height(sizePx);
    };

    const throttledPerformDrag = (event => {
      event.preventDefault();
      Ember.run.throttle(this, performDrag, event, THROTTLE_RATE);
    }).bind(this);

    const endDrag = () => {
      $document.off(DRAG_EVENTS, throttledPerformDrag);
      $document.off(END_EVENTS, endDrag);
      $composer.removeClass("clear-transitions");
      $composer.focus();
    };

    $grippie.on(START_EVENTS, event => {
      event.preventDefault();
      origComposerSize = $composer.height();
      lastMousePos = mouseYPos(event);
      $document.on(DRAG_EVENTS, throttledPerformDrag);
      $document.on(END_EVENTS, endDrag);
    });
  },

  @on('didInsertElement')
  @observes('index')
  _arrangeComposers() {
    if (!this.site.mobileView) {
      Ember.run.scheduleOnce('afterRender', () => {
        const index = this.get('index');
        let right = 340 * index + 100;
        this.$().css('right', right);
      });
    }
  },

  @observes('composeState')
  _resize() {
    const h = this.$() ? this.$().height() : 0;
    this.movePanels(h + "px");
  },

  @observes('composerOpen')
  stopBodyScrollingOnMobile() {
    if (this.site.mobileView) {
      const composerOpen = this.get('composerOpen');
      const $body = $('body, html');

      if (composerOpen) {
        $body.scrollTop(0);
        $body.addClass('noscroll');
      } else {
        $body.removeClass('noscroll');
      }
    }
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

  @computed('index')
  editorTabIndex(index) {
    return this.site.mobileView ? null : index + 1;
  },

  @computed()
  spinnerSize() {
    return this.site.mobileView ? 'large' : 'small';
  },

  @observes('emojiPickerOpen')
  setupEmojiPickerCss() {
    const emojiPickerOpen = this.get('emojiPickerOpen');
    if (emojiPickerOpen) {
      this.$().css('z-index', 100);

      Ember.run.next(() => {
        let css = { visibility: 'visible' };

        if (this.site.mobileView) {
          const editorHeight = this.$().find('.docked-editor').height();
          css['left'] = 5;
          css['right'] = 5;
          css['bottom'] = editorHeight + 5;
        } else {
          const composerWidth = 300;
          const emojiModalWidth = 400;
          const composerOffset = this.$().offset();
          const composerLeftOffset = composerOffset.left;

          css['bottom'] = 20;

          if (composerLeftOffset > emojiModalWidth) {
            css['left'] = composerLeftOffset - emojiModalWidth;
          } else if (($(window).width() - (composerLeftOffset - composerWidth)) > emojiModalWidth) {
            css['left'] = composerLeftOffset + composerWidth;
          } else {
            css['left'] = composerLeftOffset;
            css['bottom'] = this.$().height();
          }
        }

        $('.emoji-picker').css(css);
      });
    } else {
      $('.emoji-picker').css('visibility', 'hidden');
      this.$().css('z-index', 0);
    }
  },

  click() {
    const state = this.get('composeState');
    if (state === 'minimized') {
      this.open();
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
    const height = this.site.mobileView ? $(window).height() : 400;
    this.set('composeState', 'open');

    if (this.$()) {
      Ember.run.scheduleOnce('afterRender', () => {
        this.$(".d-editor-input").one('focus', () => {
          this.$(".d-editor-input").blur();
        });
      });
      this.$().animate({ height }, 200, () => {
        this.afterStreamRender();
      });
    }
  },

  collapse() {
    const height = this.site.mobileView ? 50 : 40;
    this.set('composeState', 'minimized');

    if (this.$()) {
      this.$().animate({ height }, 200);
    }
  },

  close() {
    this.set('composeState', 'closed');

    if (this.$()) {
      this.$().animate({ height: 0 }, 200, () => {
        this.sendAction('removeDocked', this.get('index'));
      });
    }
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
    return composeState === 'minimized' ? 'angle-up' : 'angle-down';
  },

  scrollPoststream() {
    const $container = this.$('.docked-composer-posts');
    const $stream = this.$('.docked-post-stream');
    const streamHeight = $stream.height();
    let self = this;

    // ensure stream is scrolled after images are loaded
    this.$('.docked-post-stream img:not(.avatar)').each(function() {
      if ($(this).height() === 0) {
        $(this).on("load", function() {
          if (this.complete) self.scrollPoststream();
        });
      }
    });

    $container.scrollTop(streamHeight);
  },

  // actions

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

    toggleEmojiPicker(state = null) {
      if (state !== null) {
        this.set('emojiPickerOpen', state);
      } else {
        this.toggleProperty('emojiPickerOpen');
      }
    },

    scrollPoststream() {
      this.scrollPoststream();
    }
  },

  // topic and posts

  @on('init')
  setTopic() {
    const id = this.get('id');
    if (id === 'new') {
      this.setProperties({
        firstPost: true,
        loading: false
      });
      return false;
    }
    this.set('topic', this.getTopic(id));
    this.subscribeToTopic();

    if (!this.site.mobileView) {
      this.appEvents.on('composer:opened', () => this.collapse());
    }
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

    getOwner(this).lookup('topic-tracking-state:main').loadStates([row]);

    this.messageBus.subscribe("/topic/" + topic.id, data => {
      if (data.type === "created") {
        postStream.triggerNewPostInStream(data.id).then(() => this.afterStreamRender());
        if (this.get('currentUser.id') !== data.user_id) {
          Discourse.notifyBackgroundCountIncrement();
        }
      }
    });
  },

  @observes('topic.postStream.loadedAllPosts')
  afterStreamRender() {
    const postStream = this.get('postStream');
    if (postStream) {
      const nearPost = this.get("topic.highest_post_number");
      postStream.refresh({ nearPost }).then(() => {
        if (this._state !== 'destroying') {
          this.set('loading', false);
          Ember.run.scheduleOnce('afterRender', () => {
            if (this.$()) {
              this.scrollPoststream();
              dockedScreenTrack(this, this.get('topic'));
            }
          });
        }
      });
    }
  },

  @computed('topic.details.loaded')
  otherUsernames(loaded) {
    if (loaded) {
      const usernames = getUsernames(this.get('topic.details.allowed_users'));
      usernames.splice(usernames.indexOf(this.get('currentUser.username')), 1);
      return formatUsernames(usernames);
    }
    return '';
  },

  @on('didInsertElement')
  @observes('otherUsernames')
  handleLongUsernames() {
    if (this.get('otherUsernames')) {
      Ember.run.scheduleOnce('afterRender', this, () => {
        const usernamesWidth = this.$(".docked-usernames").width();
        const wrapperWidth = this.$('.docked-usernames-wrapper').width();
        if (usernamesWidth > wrapperWidth) {
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
        let usernames = getUsernames(message.participants);
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
          'title': formatUsernames(targetUsernames),
          'disableEditor': false
        });
      }
    });
  },

  save() {
    if (this.get('cantSubmitPost')) return;

    const store = getOwner(this).lookup('store:main');
    const postStream = this.get('postStream');
    const user = this.get('currentUser');

    let createdPost = store.createRecord('post', {
          cooked: emojiUnescape(this.get('reply')),
          yours: true
        });
    let postOpts = {
          custom_fields: { 'quick_message': true }
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
    }).catch(popupAjaxError);
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
  }
});
