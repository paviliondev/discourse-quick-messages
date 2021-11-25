import { default as discourseComputed, observes } from 'discourse-common/utils/decorators';
import { withPluginApi } from 'discourse/lib/plugin-api';
import DiscourseURL from 'discourse/lib/url';
import { inject as service } from "@ember/service";

export default {
  name: 'quick-messages-initializer',
  initialize(container){
    const siteSettings = container.lookup("site-settings:main");
    const currentUser = container.lookup('current-user:main');
    const appEvents = container.lookup("service:app-events");
    const site = container.lookup("site:main");
    const bus = container.lookup("message-bus:main");
     
    if (currentUser) {
      bus.subscribe(`/notification/${currentUser.get("id")}`, data => {
        if (data.unread_private_messages) {
          const oldUnreadPMs = currentUser.get("unread_private_messages");
          currentUser.set('unread_private_messages', data.unread_private_messages);
          if (oldUnreadPMs !== data.unread_private_messages) {
            appEvents.trigger("notifications:changed");
          }
        }
      });
    }

    withPluginApi('0.8.12', api => {
      if (currentUser && currentUser.show_quick_messages && !siteSettings.quick_message_integrated) {
        api.decorateWidget('header-icons:before', function(helper) {
          const headerState = helper.widget.parentWidget.state;

          let contents = [];
          if (currentUser && (!site.mobileView || siteSettings.quick_message_mobile)) {
            const unread = currentUser.get('unread_private_messages');
            contents.push(
              helper.attach('header-dropdown', {
                title: 'user.private_messages',
                icon: siteSettings.quick_message_icon,
                iconId: 'toggle-messages-menu',
                active: headerState.messagesVisible,
                action: 'toggleMessages',
                contents() {
                  if (unread) {
                    return this.attach('link', {
                      action: 'toggleMessages',
                      className: 'badge-notification unread-private-message-notifications',
                      rawLabel: `${unread}`
                    });
                  }
                }
              })
            );
          }
          return contents;
        });

        api.addHeaderPanel('messages-menu', 'messagesVisible', function(attrs, state) {
          return {};
        });

        api.attachWidgetAction('header', 'toggleMessages', function() {
          this.state.messagesVisible = !this.state.messagesVisible;
        });

        api.attachWidgetAction('header', 'messagesClicked', function() {
          this.linkClickedEvent();
          this.state.messagesVisible = false;
        });

        if (siteSettings.whos_online_enabled) {
          api.modifyClass('component:docked-post', {
            onlineService: service('online-service')
          });
        }

      }

      if (siteSettings.quick_message_enabled) {
        api.modifyClass('controller:preferences/interface', {
          @discourseComputed('makeThemeDefault')
          saveAttrNames() {
            const attrs = this._super(...arguments);
            if (!attrs.includes("custom_fields")) attrs.push("custom_fields");
            return attrs;
          },

          @observes('saved')
          _updateShowQuickMessages() {
            const saved = this.get("saved");

            if (saved && currentUser && this.get("model.id") === currentUser.get("id")) {
              currentUser.set("quick_messages_pref", this.get("model.custom_fields.quick_messages_pref"));
            }
          }
        });
      }

    });
  }
};


    
