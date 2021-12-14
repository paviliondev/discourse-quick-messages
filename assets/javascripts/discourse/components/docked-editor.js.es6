import DEditor from 'discourse/components/d-editor';
import userSearch from 'discourse/lib/user-search';
import { findRawTemplate } from 'discourse-common/lib/raw-templates';
import { on } from 'discourse-common/utils/decorators';
import { isAppleDevice } from 'discourse/lib/utilities';
import { calcHeightWithKeyboard } from '../lib/docked-composer';
import { scheduleOnce, next } from "@ember/runloop";

export default DEditor.extend({
  classNames: ['docked-editor'],
  dockedUpload: false,

  @on('didInsertElement')
  setupDocked() {
    const $element = $(this.element);
    const $editorInput = $element.find('.d-editor-input');
    this._applyMentionAutocomplete($editorInput);
    this._textarea = this.element.querySelector("textarea.d-editor-input");
    this._$textarea = $(this._textarea);
    this.set("ready", true);
  },

  _applyMentionAutocomplete($editorInput) {
    const topicId = this.get('topic.id');
    $editorInput.autocomplete({
      template: findRawTemplate('user-selector-autocomplete'),
      dataSource: term => userSearch({ term, topicId, includeGroups: true }),
      key: "@",
      transformComplete: v => v.username || v.name
    });
  },

  handleIOSPositioning(type) {
    const isIOS = isAppleDevice();
    if (isIOS) {
      const $composer = $('.docked-composer');
      let style = {};

      if (type === 'blur') {
        style['height'] = '100%';
      } else {
        const $body = $('body,html');
        const heightWithKeyboard = calcHeightWithKeyboard();
        style['height'] = heightWithKeyboard;
        $body.scrollTop(0);
      }

      $composer.css(style);

      this.sendAction('scrollPoststream');
    }
  },

  actions: {
    uploadDone(upload) {
      const text = `![${upload.original_filename}](${upload.url})`;
      this._addText(this._getSelected(), text);
      scheduleOnce('afterRender', () => $('.d-editor-input').blur());
    },

    openEmojiPicker() {
      this.sendAction('toggleEmojiPicker');
    },

    emojiSelected(code){
      this._super(code);
      this.sendAction('toggleEmojiPicker');
      scheduleOnce('afterRender', () => $('.d-editor-input').click());
    },

    focusChange(state) {
      this.handleIOSPositioning(state);
      if (state === 'focus') {
        this.sendAction('toggleEmojiPicker', false);
      }
      scheduleOnce('afterRender', () => {
        if (this._state === 'destroying') return;
        this.set('focusState', state);
      });
    },

    // focus/blur events in textarea prevent normal clicks on buttons from working the first time
    buttonMousedown(e) {
      if (this.site.mobileView && this.get('focusState') === 'focus') {
        next(() => {
          const $element = $(this.element);
          const $target = $(e.target);
          if ($target.hasClass('qm-upload-picture')) {
            $element.find('.docked-upload input').click();
          };
          if ($target.hasClass('qm-emoji')) {
            this.sendAction('toggleEmojiPicker');
          }
        });
      }
    }
  }
});
