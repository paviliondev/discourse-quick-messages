import { on, observes } from 'discourse-common/utils/decorators';
import ExpandingTextArea from 'discourse/components/expanding-text-area';
import { scheduleOnce, bind } from "@ember/runloop";

export default ExpandingTextArea.extend({
  attributeBindings: ['disabled', 'rows'],
  rows: 1,

  @on('didInsertElement')
  setupListners() {
    const focus = () => this.sendAction('focusChange', 'focus');
    const blur = () => this.sendAction('focusChange', 'blur');
    this.setProperties({ focus, blur });

    scheduleOnce('afterRender', () => {
      $(this.element).one('click', bind(this, focus));
      $(this.element).on('focus', bind(this, focus));
      $(this.element).on('blur', bind(this, blur));

      // for iOS
      $(document).on('visibilitychange', bind(this, blur));
    });
  },

  @on('willDestroyElement')
  destroyListners() {
    $(this.element).off('focus', bind(this, this.get('focus')));
    $(this.element).off('blur', bind(this, this.get('blur')));
    $(document).off('visibilitychange', bind(this, this.get('blur')));
  },

  @observes('value')
  _updateAutosize() {
    scheduleOnce('afterRender', () => {
      const evt = document.createEvent('Event');
      evt.initEvent('autosize:update', true, false);
      this.element.dispatchEvent(evt);
    });
  }
});

// necessary because the expanding textarea in core doesnt apply autosize after render
