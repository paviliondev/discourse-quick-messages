import { observes, on } from 'ember-addons/ember-computed-decorators';
import ExpandingTextArea from 'discourse/components/expanding-text-area';

export default ExpandingTextArea.extend({
  attributeBindings: ['disabled', 'rows'],
  rows: 1,

  @on('didInsertElement')
  setupFocus() {
    Ember.run.scheduleOnce('afterRender', () => {
      this.$().on('focus', Ember.run.bind(this, this.handleFocus));
      this.$().on('blur', Ember.run.bind(this, this.handleFocus));
    });
  },

  @on('willDestroyElement')
  destroyFocus() {
    this.$().off('focus', Ember.run.bind(this, this.handleFocus));
    this.$().off('blur', Ember.run.bind(this, this.handleFocus));
  },

  handleFocus(e) {
    this.sendAction('textareaFocus', e);
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
