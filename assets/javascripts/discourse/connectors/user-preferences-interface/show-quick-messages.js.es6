export default {
  shouldRender(args, component) {
    if ( Discourse.SiteSettings.quick_message_enabled &&
         Discourse.SiteSettings.quick_message_user_preference && 
         args.model.quick_messages_access ) {
         return true
    }
 }
};