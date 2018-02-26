import DEditor from 'discourse/components/d-editor';
import userSearch from 'discourse/lib/user-search';
import { findRawTemplate } from 'discourse/lib/raw-templates';
import { on } from 'ember-addons/ember-computed-decorators';
import { isAppleDevice } from 'discourse/lib/utilities';
import { calcHeightWithKeyboard } from '../lib/docked-composer';

export default DEditor.extend({
  classNames: ['docked-editor'],
  dockedUpload: false,

  @on('didInsertElement')
  setupDocked() {
    const $editorInput = this.$('.d-editor-input');
    this._applyMentionAutocomplete($editorInput);
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
      Ember.run.scheduleOnce('afterRender', () => $('.d-editor-input').blur());
    },

    openEmojiPicker() {
      this.sendAction('toggleEmojiPicker');
    },

    emojiSelected(code){
      this._super(code);
      this.sendAction('toggleEmojiPicker');
      Ember.run.scheduleOnce('afterRender', () => $('.d-editor-input').click());
    },

    focusChange(state) {
      this.handleIOSPositioning(state);
      if (state === 'focus') {
        this.sendAction('toggleEmojiPicker', false);
      }
      Ember.run.scheduleOnce('afterRender', () => {
        if (this._state === 'destroying') return;
        this.set('focusState', state);
      });
    },

    // focus/blur events in textarea prevent normal clicks on buttons from working the first time
    buttonMousedown(e) {
      if (this.site.mobileView && this.get('focusState') === 'focus') {
        Ember.run.next(() => {
          const $target = $(e.target);
          if ($target.hasClass('fa-picture-o')) {
            this.$('.docked-upload input').click();
          };
          if ($target.hasClass('fa-smile-o')) {
            this.sendAction('toggleEmojiPicker');
          }
        });
      }
    }
  }
});
