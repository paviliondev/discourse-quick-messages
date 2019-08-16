import { default as computed, on } from 'ember-addons/ember-computed-decorators';
import { withPluginApi } from 'discourse/lib/plugin-api';

export default {
  name: 'quick-messages-pre-initializer',
  initialize(container) {
    const currentUser = container.lookup('current-user:main');

    if (currentUser && currentUser.show_quick_messages) {

      withPluginApi('0.8.12', api => {
        api.modifyClass('controller:application', {
          docked: Ember.A(),

          @on('didInsertElement')
          _setupQuickMessages() {
            $(window).on('resize', Ember.run.bind(this, this.maxIndex));
          },

          @on('willDestroyElement')
          _teardownQuickMessages() {
            $(window).off('resize', Ember.run.bind(this, this.maxIndex));
          },

          @computed()
          maxIndex() {
            return this.site.mobileView ? 1 : Math.floor(($(window).width() - 390) / 340);
          },

          actions: {
            addToDocked(id) {
              id = id ? id : 'new';
              let docked = this.get('docked');

              if (docked.includes(id)) return;

              let max = this.get('maxIndex');
              if (docked.length >= max) {
                docked.replace(0, 1, id);
              } else {
                docked.pushObject(id);
              }
            },

            removeDocked(index) {
              this.get('docked').removeAt(index);
            },

            updateId(index, id) {
              const docked = this.get('docked');
              docked.replace(index, 1, [id]);
            }
          }
        });
      });
    }
  }
};
