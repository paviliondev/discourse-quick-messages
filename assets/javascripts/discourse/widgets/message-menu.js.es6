import {createWidget} from 'discourse/widgets/widget';
import { h } from 'virtual-dom';

export default createWidget('messages-menu', {
  tagName: 'div.messages-menu',
  panelContents() {
    return [
      this.attach('message-list'),
      h('div.menu-footer', [
        h('hr'),
        h('ul.menu-links', [
          h('li.all-messages', this.attach('link',
            {label: 'show_more',
             action: 'goToMessages'})),
          h('li.new-message', this.attach('link',
            {icon: 'envelope',
             label: 'user.new_private_message',
             action: 'addToDocked'}))
          ]
        )])];
  },

  html() {
    return this.attach('menu-panel', { contents: () => this.panelContents() });
  },

  clickOutsideMobile(e) {
    const $centeredElement = $(document.elementFromPoint(e.clientX, e.clientY));
    if (
      $centeredElement.parents(".panel").length &&
      !$centeredElement.hasClass("header-cloak")
    ) {
      this.sendWidgetAction("toggleMessages");
    } else {
      const $window = $(window);
      const windowWidth = parseInt($window.width(), 10);
      const $panel = $(".menu-panel");
      $panel.addClass("animate");
      const panelOffsetDirection = this.site.mobileView ? "left" : "right";
      $panel.css(panelOffsetDirection, -windowWidth);
      const $headerCloak = $(".header-cloak");
      $headerCloak.addClass("animate");
      $headerCloak.css("opacity", 0);
      Ember.run.later(() => this.sendWidgetAction("toggleMessages"), 200);
    }
  },

  clickOutside(e) {
    if (this.site.mobileView) {
      this.clickOutsideMobile(e);
    } else {
      this.sendWidgetAction("toggleMessages");
    }
  }
});
