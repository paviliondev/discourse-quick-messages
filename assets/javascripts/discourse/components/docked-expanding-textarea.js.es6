import { observes } from 'ember-addons/ember-computed-decorators';
import ExpandingTextArea from 'discourse/components/expanding-text-area';

export default ExpandingTextArea.extend({
  attributeBindings: ['disabled'],

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
