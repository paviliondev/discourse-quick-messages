import { default as computed } from 'ember-addons/ember-computed-decorators';

export default Ember.Component.extend({
  tagName: "div",
  classNames: 'docked-post',

  @computed('post.yours')
  contentClass(yours) {
    return yours ? 'yours' : '';
  },

  @computed('onlineService.users.@each', 'post.user_id')
  avatarClasses(onlineUsers, userId) {
    let classes = 'docked-avatar';

    const onlineService = this.get('onlineService');
    if (onlineService && onlineService.isUserOnline(userId)) {
      classes += ' user-online';
    }

    return classes;
  },

  @computed('post.post_type')
  isSmallAction(type) {
    const postTypes = this.site.post_types;
    return type === postTypes.small_action;
  }
});
