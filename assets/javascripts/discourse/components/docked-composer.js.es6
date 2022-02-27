import { default as discourseComputed, on, observes } from 'discourse-common/utils/decorators';
import { headerHeight } from 'discourse/components/site-header';
import { getCurrentUserMessages } from '../lib/user-messages';
import { emojiUnescape } from 'discourse/lib/text';
import { dockedScreenTrack } from '../lib/docked-screen-track';
import { deepEqual } from "discourse-common/lib/object";
import DiscourseURL from 'discourse/lib/url';
import { getUsernames, formatUsernames } from '../lib/docked-composer';
import { popupAjaxError } from 'discourse/lib/ajax-error';
import Component from '@ember/component';
import { or, equal, alias } from "@ember/object/computed";
import { throttle, scheduleOnce, next } from "@ember/runloop";
import { Promise } from "rsvp";
import { set } from "@ember/object";
import I18n from "I18n";

const _create_serializer = {
        raw: 'reply',
        title: 'title',
        topic_id: 'topic.id',
        target_recipients: 'targetUsernames',
      };

const START_EVENTS = "touchstart mousedown";
const DRAG_EVENTS = "touchmove mousemove";
const END_EVENTS = "touchend mouseup";

const MIN_COMPOSER_SIZE = 240;
const THROTTLE_RATE = 20;

function mouseYPos(e) {
  return e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
}

export default Component.extend({
  tagName: "div",
  classNameBindings: [':docked-composer', 'composeState', "integratedCompose", "firstPost:new"],
  disableSubmit: or("loading", "uploading"),
  composerOpen: equal('composeState', 'open'),
  postStream: alias('topic.postStream'),
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
    const integratedCompose = this.get('integratedCompose');
    this.set('composeState', 'open');

    if (!this.site.mobileView && !integratedCompose) {
      this.setupComposerResizeEvents();
    }
  },

  setupComposerResizeEvents() {
    const $composer = $(this.element);
    const $grippie = $composer.find(".docked-composer-header");
    const $document = $(document);
    let origComposerSize = 0;
    let lastMousePos = 0;

    const performDrag = event => {
      $composer.trigger("div-resizing");
      $composer.addClass("clear-transitions");
      const currentMousePos = mouseYPos(event);
      let size = origComposerSize + (lastMousePos - currentMousePos);

      const winHeight = $(window).height();
      size = Math.min(size, winHeight - headerHeight());
      size = Math.max(size, MIN_COMPOSER_SIZE);
      const sizePx = `${size}px`;
      this.movePanels(sizePx);
      $composer.height(sizePx);
    };

    const throttledPerformDrag = (event => {
      event.preventDefault();
      throttle(this, performDrag, event, THROTTLE_RATE);
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
    if (!this.get('singleWindow')) {
      scheduleOnce('afterRender', () => {
        const index = this.get('index');
        let right = this.site.mobileView ? 0 : 340 * index + 100;
        $(this.element).css('right', right);
      });
    }
  },

  @observes('composeState')
  _resize() {
    const h = $(this.element) ? $(this.element).height() : 0;
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

  @discourseComputed('targetUsernames', 'missingReplyCharacters')
  cantSubmitPost() {
    if (this.get('replyLength') < 1) return true;
    return this.get('targetUsernames') && (this.get('targetUsernames').trim() + ',').indexOf(',') === 0;
  },

  @discourseComputed('reply')
  replyLength() {
    let reply = this.get('reply') || "";
    return reply.replace(/\s+/img, " ").trim().length;
  },

  @discourseComputed('index', 'singleWindow')
  editorTabIndex(index, singleWindow) {
    return singleWindow ? null : index + 1;
  },

  @discourseComputed
  spinnerSize() {
    return this.site.mobileView ? 'large' : 'small';
  },

  @observes('emojiPickerOpen')
  setupEmojiPickerCss() {
    const emojiPickerOpen = this.get('emojiPickerOpen');
    if (emojiPickerOpen) {
      $(this.element).css('z-index', 100);

      next(() => {
        let css = { visibility: 'visible' };

        if (this.site.mobileView) {
          const editorHeight = $(this.element).find('.docked-editor').height();
          css['left'] = 5;
          css['right'] = 5;
          css['bottom'] = editorHeight + 5;
        } else {
          const composerWidth = 300;
          const emojiModalWidth = 400;
          const composerOffset = $(this.element).offset();
          const composerLeftOffset = composerOffset.left;

          css['bottom'] = 20;

          if (composerLeftOffset > emojiModalWidth) {
            css['left'] = composerLeftOffset - emojiModalWidth;
          } else if (($(window).width() - (composerLeftOffset - composerWidth)) > emojiModalWidth) {
            css['left'] = composerLeftOffset + composerWidth;
          } else {
            css['left'] = composerLeftOffset;
            css['bottom'] = $(this.element).height();
          }
        }

        $('.emoji-picker').css(css);
      });
    } else {
      $('.emoji-picker').css('visibility', 'hidden');
      $(this.element).css('z-index', 0);
    }
  },

  click() {
    const state = this.get('composeState');
    if (state === 'minimized') {
      this.open();
    }
  },

  closeAutocomplete() {
    $(this.element).find('.d-editor-input').autocomplete({ cancel: true });
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
    const $element = $(this.element);
    const height = this.site.mobileView ? $(window).height() : 400;
    this.set('composeState', 'open');

    if ($element) {
      scheduleOnce('afterRender', () => {
        $element.find(".d-editor-input").one('focus', () => {
          $element.find(".d-editor-input").blur();
        });
      });
      $element.animate({ height }, 200, () => {
        this.afterStreamRender();
      });
    }
  },

  collapse() {
    const $element = $(this.element);
    const height = this.site.mobileView ? 50 : 40;
    this.set('composeState', 'minimized');

    if ($element) {
      $element.animate({ height }, 200);
    }
  },

  close() {
    const $element = $(this.element);
    this.set('composeState', 'closed');

    if ($element) {
      $element.animate({ height: 0 }, 200, () => {
        this.sendAction('removeDocked', this.get('index'));
      });
    }
  },

  cancel() {
    const self = this;
    return new Promise(function (resolve) {
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

  @discourseComputed('composeState')
  togglerIcon(composeState) {
    return composeState === 'minimized' ? 'angle-up' : 'angle-down';
  },

  @discourseComputed('composeState')
  togglerTitle(composeState) {
    return composeState === 'minimized' ? 'composer.toggler.maximize' : 'composer.toggler.minimize';
  },

  scrollPoststream() {
    const $element = $(this.element);
    const $container = $element.find('.docked-composer-posts');
    const $stream = $element.find('.docked-post-stream');
    const streamHeight = $stream.height();
    let self = this;

    // ensure stream is scrolled after images are loaded
    $element.find('.docked-post-stream img:not(.avatar)').each(function() {
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
    },

    back() {
      this.back();
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

    if (!this.get('singleWindow')) {
      this.appEvents.on('composer:opened', () => this.collapse());
    }
  },

  getTopic(id) {
    return this.store.createRecord('topic', { id });
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

    this.topicTrackingState.loadStates([row]);

    this.messageBus.subscribe("/topic/" + topic.id, data => {
      if (data.type === "created") {
        postStream.triggerNewPostsInStream([data.id]).then(() => this.afterStreamRender());
        if (this.get('currentUser.id') !== data.user_id) {
          Discourse.incrementBackgroundContextCount();
        }
      }
    });
  },

  @observes('topic.postStream.loadedAllPosts')
  afterStreamRender() {
    const $element = $(this.element);
    const postStream = this.get('postStream');
    
    if (postStream) {
      const nearPost = this.get("topic.highest_post_number");
      
      postStream.refresh({ nearPost }).then(() => {
        if (this._state !== 'destroying') {
          this.set('loading', false);
          
          scheduleOnce('afterRender', () => {
            if ($element) {
              this.scrollPoststream();
              dockedScreenTrack(this, this.get('topic'));
            }
          });
        }
      });
    }
  },

  @discourseComputed('topic.details.loaded')
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
    const $element = $(this.element);
    
    if (this.get('otherUsernames')) {
      scheduleOnce('afterRender', this, () => {
        const usernamesWidth = $element.find(".docked-usernames").width();
        const wrapperWidth = $element.find('.docked-usernames-wrapper').width();
        
        if (usernamesWidth > wrapperWidth) {
          this.set("hiddenUsernames", true);
        }
      });
    }
  },

  @observes('targetUsernames')
  createOrContinue() {
    const currentUsername = this.get('currentUser.username');
    const integratedCompose = this.get('integratedCompose');
    let existingId = null;
    let targetUsernames = this.get('targetUsernames').split(',');
    targetUsernames.push(currentUsername);

    getCurrentUserMessages(this).then((result) => {
      result.forEach((message) => {
        let usernames = getUsernames(message.participants);
        if (usernames.indexOf(currentUsername) === -1) {
          usernames.push(currentUsername);
        }

        if (deepEqual([...usernames].sort(), [...targetUsernames].sort())) {
          existingId = message.id;
        }
      });

      if (existingId) {
        const docked = this.get('docked');
        if (docked && docked.indexOf(existingId) > -1) {
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

    const postStream = this.get('postStream');
    const user = this.get('currentUser');

    let createdPost = this.store.createRecord('post', {
          cooked: emojiUnescape(this.get('reply')),
          yours: true
        });
    let postOpts = {
          custom_fields: { 'quick_message': true }
        };

    this.serialize(_create_serializer, postOpts);
    
    postOpts.archetype = postOpts.topic_id ? 'regular' : 'private_message';
    
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
        set(dest, f, val);
      }
    });
    return dest;
  }
});
