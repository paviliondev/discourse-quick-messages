export default {
  setupComponent(args, component) {
    const appController = this.container.lookup('controller:application');
    const docked = appController.get('docked');
    const maxIndex = appController.get('maxIndex');
    component.setProperties({
      docked: docked,
      maxIndex: maxIndex
    })
  },

  actions: {
    removeDocked(index) {
      const appController = this.container.lookup('controller:application');
      appController.send('removeDocked', index);
    }
  }
}
