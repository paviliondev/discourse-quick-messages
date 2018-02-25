import DEditor from 'discourse/components/d-editor';
import userSearch from 'discourse/lib/user-search';
import { findRawTemplate } from 'discourse/lib/raw-templates';
import { on } from 'ember-addons/ember-computed-decorators';

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

  actions: {
    addText(text) {
      this._addText(this._getSelected(), text);
    },

    openEmojiPicker() {
      this.sendAction('toggleEmojiPicker');
    }
  }

});
