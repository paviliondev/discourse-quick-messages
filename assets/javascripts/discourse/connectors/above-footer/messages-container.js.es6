import { getOwner } from 'discourse-common/lib/get-owner';

export default {
  setupComponent(args, component) {
    const appController = getOwner(this).lookup('controller:application');
    const docked = appController.get('docked');
    const maxIndex = appController.get('maxIndex');
    const quickButtonEnabled = Discourse.SiteSettings.quick_message_quick_button_enabled;
    const mobileView = component.get('site.mobileView');
    const showQuickButton = quickButtonEnabled && !mobileView;

    this.set('component', component);

    component.setProperties({
      docked,
      maxIndex,
      showQuickButton
    });
  },

  actions: {
    removeDocked(index) {
      const appController = getOwner(this).lookup('controller:application');
      appController.send('removeDocked', index);
    },

    updateId(index, id) {
      const appController = getOwner(this).lookup('controller:application');
      appController.send('updateId', index, id);
    },

    openQuick() {
      const appController = getOwner(this).lookup('controller:application');
      this.get('component').set('targetUsernames', Discourse.SiteSettings.quick_message_quick_button_target);
      appController.send('openQuick');
    }
  }
};
