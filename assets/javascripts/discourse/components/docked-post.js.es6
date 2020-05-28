import { default as discourseComputed } from 'discourse-common/utils/decorators';
import Component from "@ember/component";

export default Component.extend({
  tagName: "div",
  classNames: 'docked-post',

  @discourseComputed('post.yours')
  contentClass(yours) {
    return yours ? 'yours' : '';
  },

  @discourseComputed('onlineService.users.@each', 'post.user_id')
  avatarClasses(onlineUsers, userId) {
    let classes = 'docked-avatar';

    const onlineService = this.get('onlineService');
    if (onlineService && onlineService.isUserOnline(userId)) {
      classes += ' user-online';
    }

    return classes;
  },

  @discourseComputed('post.post_type')
  isSmallAction(type) {
    const postTypes = this.site.post_types;
    return type === postTypes.small_action;
  }
});
