import UploadMixin from "discourse/mixins/upload";

export default Ember.Component.extend(UploadMixin, {
  classNames: 'docked-upload',

  uploadDone(upload) {
    this.sendAction("addText", `![${upload.original_filename}](${upload.url})`);
  }
});
