import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { uploadTranslate } from 'discourse/controllers/upload-selector';
import { allowsAttachments } from 'discourse/lib/utilities';

export default Ember.Component.extend({
  tagName: "div",
  classNameBindings: [':docked-upload', ':docked-modal', 'visible::hidden'],
  local: true,
  imageUrl: null,
  showMore: false,
  remote: Ember.computed.not("local"),

  @on('didInsertElement')
  @observes('local')
  selectedChanged() {
    Ember.run.next(() => {
      // *HACK* to select the proper radio button
      const value = this.get('local') ? 'local' : 'remote';
      $('input:radio[name="upload"]').val([value]);
      $('.inputs input:first').focus();
    });
  },

  @computed()
  title() {
    return uploadTranslate("title");
  },

  touchStart(evt) {
    // HACK: workaround Safari iOS being really weird and not shipping click events
    if (this.capabilities.isSafari && evt.target.id === "filename-input") {
      this.$('#filename-input').click();
    }
  },

  @computed
  uploadIcon() {
    return allowsAttachments() ? "upload" : "picture-o";
  },

  close: function() {
    this.set('visible', false)
  },

  actions: {
    upload() {
      if (this.get('local')) {
        this.$().parents('.docked-editor').fileupload('add', { fileInput: $('#filename-input') });
      } else {
        const imageUrl = this.get('imageUrl') || '';
        const imageLink = imageUrl.substr(imageUrl.lastIndexOf('/') + 1)
        this.sendAction('addText', `![${imageLink}](${imageUrl})`)
      }
      this.close()
    },

    closeModal() {
      this.close()
    },

    useLocal() {
      this.setProperties({ local: true, showMore: false});
    },

    useRemote() {
      this.set("local", false);
    },

    toggleShowMore() {
      this.toggleProperty("showMore");
    }
  }

});
