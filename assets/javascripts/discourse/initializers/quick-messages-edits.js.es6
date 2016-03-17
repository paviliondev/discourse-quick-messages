import ApplicationRoute from 'discourse/routes/application';
import ApplicationController from 'discourse/controllers/application';
import TopicController from 'discourse/controllers/topic';
import Topic from 'discourse/models/topic';
import ComposerController from 'discourse/controllers/composer';
import ComposerView from 'discourse/views/composer';
import Composer from 'discourse/models/composer';
import UserMenu from 'discourse/components/user-menu';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';

export default {
  name: 'quick-messages-edits',
  initialize(){

    ApplicationRoute.reopen({
      actions: {

        dockedCompose: function(messages) {
          const composerController = this.controllerFor('composer')
          var opts = {
            action: Composer.PRIVATE_MESSAGE,
            usernames: "",
            archetypeId: 'private_message',
            draftKey: 'new_private_message',
            topic: null
          }
          composerController.prepareDockedCompose(true, messages)
          composerController.open(opts)
        },

        dockedReply: function(topic, messages) {
          const composerController = this.controllerFor('composer')
          var opts = {
            action: Composer.REPLY,
            draftKey: topic.draft_key,
            draftSequence: topic.draft_sequence,
            topic: topic
          }
          composerController.prepareDockedCompose(false, messages)
          composerController.open(opts)
        }

      }
    });

    ComposerView.reopen({

      @on('init')
      bindDocked() {
        var classes = this.get('classNameBindings')
        classes.push('controller.docked:docked')
        this.set('classNameBindings', classes)
      },

      // these methods override existing composer view methods

      @computed('composer.composeState', 'controller.skipStateChange')
      composeState(composeState) {
        if (this.get('controller.skipStateChange')) {
          return Composer.OPEN;
        } else {
          return composeState || Composer.CLOSED;
        }
      },

      keyDown(e) {
        var enter = Boolean(e.which === 13),
            shift = Boolean(e.shiftKey),
            escape = Boolean(e.which === 27),
            ctrlCmd = Boolean(e.ctrlKey || e.metaKey),
            controller = this.get('controller');
        if (escape) {
          controller.send('hitEsc')
          return false;
        }
        if (controller.get('docked')){
          if (enter && shift) {
            controller.get('model').appendText('\n')
            return false;
          } else if (enter) {
            controller.send('save')
            return false;
          }
        } else if (enter && ctrlCmd) {
          controller.send('save')
          return false;
        }
      }

      // end of methods that override existing composer view methods

    });

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
