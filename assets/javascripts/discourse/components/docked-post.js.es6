import { default as computed } from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
  tagName: "div",
  classNames: 'docked-post',

  @computed('post.yours')
  contentClass(yours) {
    return yours ? 'yours' : '';
  },

  @computed('post.post_type')
  isSmallAction(type) {
    const postTypes = this.site.post_types;
    return type === postTypes.small_action;
  }
});
