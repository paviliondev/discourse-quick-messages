export default {
  setupComponent(args, component) {
    const controller = this.container.lookup('controller:application');
    const docked = controller.get('docked');
    const maxIndex = controller.get('maxIndex');
    component.setProperties({
      docked: docked,
      maxIndex: maxIndex
    })
  }
}
