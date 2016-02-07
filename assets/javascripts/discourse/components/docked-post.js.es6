export default Ember.Component.extend({
  tagName: "div",
  classNames: 'docked-post',

  didInsertElement: function() {
    if (this.get('post.post_number') === 1) {
      Ember.run.schedule('afterRender', () => {
        $('#reply-control .composer-fields').scrollTop($('.docked-post-stream').height())
      })
    }
  }


})
