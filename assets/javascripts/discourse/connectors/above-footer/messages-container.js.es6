import { getOwner } from 'discourse-common/lib/get-owner';

export default {
  setupComponent(args, component) {
    const appController = getOwner(this).lookup('controller:application');
    const docked = appController.get('docked');
    const maxIndex = appController.get('maxIndex');
    component.setProperties({
      docked: docked,
      maxIndex: maxIndex
    })
  },

  actions: {
    removeDocked(index) {
      const appController = getOwner(this).lookup('controller:application');
      appController.send('removeDocked', index);
    }
  }
}
