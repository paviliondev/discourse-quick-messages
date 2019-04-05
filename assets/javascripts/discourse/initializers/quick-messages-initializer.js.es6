import { default as computed, observes } from 'ember-addons/ember-computed-decorators';
import { withPluginApi } from 'discourse/lib/plugin-api';
import DiscourseURL from 'discourse/lib/url';
import { getOwner } from 'discourse-common/lib/get-owner';

export default {
  name: 'quick-messages-initializer',
  initialize(container){
    const siteSettings = container.lookup("site-settings:main");
    const currentUser = container.lookup('current-user:main');
    const site = container.lookup("site:main");

    withPluginApi('0.8.12', api => {

      if (currentUser && currentUser.show_quick_messages) {

        api.reopenWidget('header-notifications', {
          html(attrs) {
            let nodes = this._super(attrs);
            return nodes.filter((n) => {
              let obj = n.properties || n.attrs;
              return !obj.className.match( /(messages|ring)/ );
            });
          }
        });

        api.decorateWidget('header-icons:before', function(helper) {
          const headerState = helper.widget.parentWidget.state;

          let contents = [];
          if (currentUser && (!site.mobileView || siteSettings.quick_message_mobile)) {
            const unread = currentUser.get('unread_private_messages');
            contents.push(helper.attach('header-dropdown', {
              title: 'user.private_messages',
              icon: siteSettings.quick_message_icon,
              iconId: 'toggle-messages-menu',
              active: headerState.messagesVisible,
              action: 'toggleMessages',
              contents() {
                if (unread) {
                  return this.attach('link', {
                    action: 'toggleMessages',
                    className: 'badge-notification unread-private-messages',
                    rawLabel: `${unread}`
                  });
                }
              }
            }));
          }
          return contents;
        });

        api.addHeaderPanel('messages-menu', 'messagesVisible', function(attrs, state) {
          return {};
        });

        api.attachWidgetAction('header', 'toggleMessages', function() {
          this.state.messagesVisible = !this.state.messagesVisible;
        });

        api.attachWidgetAction('header', 'addToDocked', function(id) {
          this.messagesClicked();
          getOwner(this).lookup('controller:application').send('addToDocked', id);
        });

        api.attachWidgetAction('header', 'messagesClicked', function() {
          this.linkClickedEvent();
          this.state.messagesVisible = false;
        });

        api.attachWidgetAction('header', 'goToMessages', function() {
          this.messagesClicked();
          DiscourseURL.routeTo('/users/' + this.currentUser.get('username') + '/messages');
        });

        if (Discourse.SiteSettings.whos_online_enabled) {
          api.modifyClass('component:docked-post', {
            onlineService: Ember.inject.service('online-service')
          });
        }

      }

      if (Discourse.SiteSettings.quick_message_enabled) {
        api.modifyClass('controller:preferences/interface', {
          @computed('makeThemeDefault')
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
