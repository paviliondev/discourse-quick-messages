export default Ember.View.extend({

  didInsertElement: function() {
    var $parentEl = this.get('parentView').$()
    if (!$parentEl.hasClass('icons')) {
      $parentEl.addClass('plugin-menu-icons')
    }
  }

})
