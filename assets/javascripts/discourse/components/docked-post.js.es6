import { default as computed } from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
  tagName: "div",
  classNames: 'docked-post',

  @computed('post.yours')
  contentClass(yours) {
    return yours ? 'yours' : '';
  }
});
