import UploadMixin from "discourse/mixins/upload";
import Component from "@ember/component";

export default Component.extend(UploadMixin, {
  tagName: 'button',
  classNames: 'docked-upload btn btn-small',
  attributeBindings: ['uploading:disabled'],
  type: 'PUT',

  input() {
    return $(this.element).find('input');
  },

  click(e) {
    if (!$(e.target).is('input')) {
      this.input().trigger('click');
    }
  }
});
