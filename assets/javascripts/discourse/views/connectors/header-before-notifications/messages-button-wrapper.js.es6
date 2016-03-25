export default Ember.View.extend({
  tagName: 'li',
  classNames: ['messages-button-wrapper'],

  didInsertElement: function() {
    var $parentEl = this.$().parent()
    if (!$parentEl.hasClass('icons')) {
      $parentEl.addClass('plugin-menu-icons')
    }
  }
})
