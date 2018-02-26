import { observes, on } from 'ember-addons/ember-computed-decorators';
import ExpandingTextArea from 'discourse/components/expanding-text-area';

export default ExpandingTextArea.extend({
  attributeBindings: ['disabled', 'rows'],
  rows: 1,

  @on('didInsertElement')
  setupListners() {
    const focus = () => this.sendAction('focusChange', 'focus');
    const blur = () => this.sendAction('focusChange', 'blur');
    this.setProperties({ focus, blur });

    Ember.run.scheduleOnce('afterRender', () => {
      this.$().one('click', Ember.run.bind(this, focus));
      this.$().on('focus', Ember.run.bind(this, focus));
      this.$().on('blur', Ember.run.bind(this, blur));

      // for iOS
      $(document).on('visibilitychange', Ember.run.bind(this, blur));
    });
  },

  @on('willDestroyElement')
  destroyListners() {
    this.$().off('focus', Ember.run.bind(this, this.get('focus')));
    this.$().off('blur', Ember.run.bind(this, this.get('blur')));
    $(document).off('visibilitychange', Ember.run.bind(this, this.get('blur')));
  },

  @observes('value')
  _updateAutosize() {
    Ember.run.scheduleOnce('afterRender', () => {
      const evt = document.createEvent('Event');
      evt.initEvent('autosize:update', true, false);
      this.element.dispatchEvent(evt);
    });
  }
});

// necessary because the expanding textarea in core doesnt apply autosize after render
