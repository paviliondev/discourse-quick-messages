import UserMenu from 'discourse/components/user-menu';

export default {
  name: 'quick-messages-edits',
  initialize(){

    // This removes messages from the notifications stream in the user menu.

    UserMenu.reopen({

      setup: function() {
        if (!Discourse.Mobile.mobileView) {
          this.addObserver('notifications', this.removeMessages)
        }
      }.on('willInsertElement'),

      removeMessages: function() {
        var notifications = this.get('notifications')
        if (!notifications) {return}
        var notMessages = notifications.filter(function(n) {
          return n.notification_type !== 6;
        });
        this.removeObserver('notifications', this.removeMessages)
        this.set('notifications', notMessages)
        this.addObserver('notifications', this.removeMessages)
      }

    })

  }
}
