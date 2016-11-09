import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { withPluginApi } from 'discourse/lib/plugin-api';
import SiteHeader from 'discourse/components/site-header';
import { getCurrentUserMessageCount } from 'discourse/plugins/discourse-quick-messages/discourse/helpers/user-messages';
import DiscourseURL from 'discourse/lib/url';
import AppController from 'discourse/controllers/application';

export default {
  name: 'quick-messages-edits',
  initialize(){

    withPluginApi('0.1', api => {
      api.decorateWidget('header-icons:before', function(helper) {
        const currentUser = api.getCurrentUser(),
              headerState = helper.widget.parentWidget.state;

        let contents = [];
        if (!helper.widget.site.mobileView && currentUser) {
          const unread = currentUser.get('unread_private_user_messages')
          contents.push(helper.attach('header-dropdown', {
            title: 'user.private_messages',
            icon: 'envelope',
            iconId: 'toggle-messages-menu',
            active: headerState.messagesVisible,
            action: 'toggleMessages',
            contents() {
              if (unread) {
                return this.attach('link', {
                  action: 'toggleMessages',
                  className: 'badge-notification unread-private-messages',
                  rawLabel: unread
                });
              }
            }
          }));
        }
        if (headerState.messagesVisible) {
          contents.push(helper.attach('messages-menu'))
        }
        return contents
      })

      api.attachWidgetAction('header', 'toggleMessages', function() {
        this.state.messagesVisible = !this.state.messagesVisible
      })

      api.attachWidgetAction('header', 'addToDocked', function(id) {
        this.messagesClicked()
        this.container.lookup('controller:application').send('addToDocked', id)
      })

      api.attachWidgetAction('header', 'messagesClicked', function() {
        this.linkClickedEvent()
        this.state.messagesVisible = false
      })

      api.attachWidgetAction('header', 'goToMessages', function() {
        this.messagesClicked()
        DiscourseURL.routeTo('/users/' + this.currentUser.get('username') + '/messages')
      })
    });

    SiteHeader.reopen({
      @observes('currentUser.unread_private_messages', 'currentUser.topic_count', 'currentUser.reply_count')
      @on('init')
      _messagesChanged() {
        if (this.get('currentUser')) {
          const docked = this.container.lookup('controller:application').get('docked');
          getCurrentUserMessageCount(this, docked).then((count) => {
            this.currentUser.set('unread_private_user_messages', count);
            this.queueRerender();
          })
        }
      },
    })

    AppController.reopen({
      docked: Ember.A(),

      @on('didInsertElement')
      _setupQuickMessages() {
        this.setMaxIndex()
        $(window).on('resize', Ember.run.bind(this, this.setMaxIndex))
      },

      @on('willDestroyElement')
      _teardownQuickMessages() {
        $(window).off('resize', Ember.run.bind(this, this.setMaxIndex))
      },

      setMaxIndex: function() {
        this.set('maxIndex', (Math.floor(($(window).width() - 390) / 340)) - 1)
      },

      actions: {
        addToDocked(id) {
          var id = id ? id : 'new',
              docked = this.get('docked');
          if (docked.contains(id)) {return}
          var max = this.get('maxIndex');
          if (docked.length > max) {
            docked.insertAt(max, id)
          } else {
            docked.pushObject(id)
          }
          this.set('docked', docked)
        },

        removeDocked(index) {
          var docked = this.get('docked');
          docked.removeAt(index)
          this.set('docked', docked)
        },

        onScreen(index) {
          var docked = this.get('docked');
          var max = this.get('maxIndex'),
              item = docked.slice(index, index + 1);
          docked.removeAt(index)
          docked.insertAt(max, item[0])
          this.set('docked', docked)
        }
      }
    })

  }
}
