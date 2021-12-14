import UploadMixin from "discourse/mixins/upload";
import UppyUploadMixin from "discourse/mixins/uppy-upload";
import Component from "@ember/component";

export default Component.extend(UppyUploadMixin, {
  id: "docked-upload",
  tagName: "button",
  type: "quick_message_upload",
  classNames: "docked-upload btn btn-small",
  attributeBindings: ["uploading:disabled"],
  fileInputSelector: ".docked-upload-file-input",

  input() {
    return $(this.element).find("input");
  },

  click(e) {
    if (!$(e.target).is("input")) {
      this.input().trigger("click");
    }
  },
});
