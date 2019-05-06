import { getOwner } from 'discourse-common/lib/get-owner';

export default {
  setupComponent(args, component) {
    const appController = getOwner(this).lookup('controller:application');
    const docked = appController.get('docked');
    const maxIndex = appController.get('maxIndex');
    const singleWindow = component.get('mobileView');

    component.setProperties({
      docked,
      maxIndex,
      singleWindow
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
    }
  }
};
