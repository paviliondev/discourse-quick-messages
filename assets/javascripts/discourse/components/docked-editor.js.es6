import loadScript from 'discourse/lib/load-script';
import { default as computed, on, observes } from 'ember-addons/ember-computed-decorators';
import { showSelector } from "discourse/lib/emoji/emoji-toolbar";
import userSearch from 'discourse/lib/user-search';
import { linkSeenMentions, fetchUnseenMentions } from 'discourse/lib/link-mentions';
import { SEPARATOR as categoryHashtagSeparator,
         categoryHashtagTriggerRule
       } from 'discourse/lib/category-hashtags';

// Our head can be a static string or a function that returns a string
// based on input (like for numbered lists).
function getHead(head, prev) {
  if (typeof head === "string") {
    return [head, head.length];
  } else {
    return getHead(head(prev));
  }
}

const OP = {
  NONE: 0,
  REMOVED: 1,
  ADDED: 2
};

const _createCallbacks = [];

class Toolbar {

  constructor(site) {
    const self = this
    this.shortcuts = {};

    this.groups = [
      {group: 'quick', buttons: []}
    ];

    this.addButton({
      id: 'upload',
      group: 'quick',
      icon: 'picture-o',
      title: 'upload',
      action: 'upload'
    });

    this.addButton({
      id: 'emoji',
      group: 'quick',
      icon: 'smile-o',
      action: 'emoji',
      title: 'composer.emoji'
    });

  }

  addButton(button) {
    const g = this.groups.findProperty('group', button.group);
    if (!g) {
      throw `Couldn't find toolbar group ${button.group}`;
    }

    const createdButton = {
      id: button.id,
      className: button.className || button.id,
      icon: button.icon || button.id,
      action: button.action || 'toolbarButton',
      perform: button.perform || Ember.K,
      trimLeading: button.trimLeading
    };

    if (button.sendAction) {
      createdButton.sendAction = button.sendAction;
    }

    const title = I18n.t(button.title || `composer.${button.id}_title`);
    if (button.shortcut) {
      const mac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = mac ? 'Meta' : 'Ctrl';
      var shortcutTitle = `${mod}+${button.shortcut}`;

      // Mac users are used to glyphs for shortcut keys
      if (mac) {
        shortcutTitle = shortcutTitle
            .replace('Shift', "\u21E7")
            .replace('Meta', "\u2318")
            .replace('Alt', "\u2325")
            .replace(/\+/g, '');
      } else {
        shortcutTitle = shortcutTitle
            .replace('Shift', I18n.t('shortcut_modifier_key.shift'))
            .replace('Ctrl', I18n.t('shortcut_modifier_key.ctrl'))
            .replace('Alt', I18n.t('shortcut_modifier_key.alt'));
      }

      createdButton.title = `${title} (${shortcutTitle})`;

      this.shortcuts[`${mod}+${button.shortcut}`.toLowerCase()] = createdButton;
    } else {
      createdButton.title = title;
    }

    if (button.unshift) {
      g.buttons.unshift(createdButton);
    } else {
      g.buttons.push(createdButton);
    }
  }
}

export default Ember.Component.extend({
  classNames: ['docked-editor'],
  ready: false,
  insertLinkHidden: true,
  dockedUpload: false,
  link: '',
  lastSel: null,
  _mouseTrap: null,
  uploadProgress: 0,
  _xhr: null,

  @on('didInsertElement')
  _startUp() {
    const container = this.get('container'),
          $editorInput = this.$('.d-editor-input');

    this._applyEmojiAutocomplete(container, $editorInput);
    loadScript('defer/html-sanitizer-bundle').then(() => this.set('ready', true));
    const mouseTrap = Mousetrap(this.$('.d-editor-input')[0]);

    const shortcuts = this.get('toolbar.shortcuts');
    Ember.keys(shortcuts).forEach(sc => {
      const button = shortcuts[sc];
      mouseTrap.bind(sc, () => {
        this.send(button.action, button);
        return false;
      });
    });

    const topicId = this.get('topic.id');
    const template = this.container.lookup('template:user-selector-autocomplete.raw');
    const $input = this.$('.d-editor-input');
    $input.autocomplete({
      template,
      dataSource: term => userSearch({ term, topicId, includeGroups: true }),
      key: "@",
      transformComplete: v => v.username || v.name
    });
    this.$('.d-editor-input').putCursorAtEnd();

    this._bindUploadTarget();
    this._mouseTrap = mouseTrap;
  },

  @on('willDestroyElement')
  _shutDown() {
    const mouseTrap = this._mouseTrap;
    Ember.keys(this.get('toolbar.shortcuts')).forEach(sc => mouseTrap.unbind(sc));
  },

  @computed
  uploadPlaceholder() {
    return `[${I18n.t('uploading')}]() `;
  },

  @computed('placeholder')
  placeholderTranslated(placeholder) {
    if (placeholder) return I18n.t(placeholder);
    return null;
  },

  @computed
  markdownOptions() {
    return {
      lookupAvatarByPostNumber: (postNumber, topicId) => {
        const topic = this.get('topic');
        if (!topic) { return; }

        const posts = topic.get('postStream.posts');
        if (posts && topicId === topic.get('id')) {
          const quotedPost = posts.findProperty("post_number", postNumber);
          if (quotedPost) {
            return Discourse.Utilities.tinyAvatar(quotedPost.get('avatar_template'));
          }
        }
      }
    };
  },

  _renderUnseenMentions: function($preview, unseen) {
    fetchUnseenMentions($preview, unseen).then(() => {
      linkSeenMentions($preview, this.siteSettings);
      this._warnMentionedGroups($preview);
    });
  },

  _resetUpload(removePlaceholder) {
    this._validUploads--;
    if (this._validUploads === 0) {
      this.setProperties({ uploadProgress: 0, isUploading: false, isCancellable: false });
    }
    if (removePlaceholder) {
      this.set('value', this.get('value').replace(this.get('placeholder'), ""));
    }
  },

  _bindUploadTarget() {
    this._unbindUploadTarget(); // in case it's still bound, let's clean it up first

    const $element = this.$();
    const csrf = this.session.get('csrfToken');
    const uploadPlaceholder = this.get('uploadPlaceholder');

    $element.fileupload({
      url: Discourse.getURL(`/uploads.json?client_id=${this.messageBus.clientId}&authenticity_token=${encodeURIComponent(csrf)}`),
      dataType: "json",
      pasteZone: $element,
    });

    $element.on('fileuploadsubmit', (e, data) => {
      const isUploading = Discourse.Utilities.validateUploadedFiles(data.files);
      data.formData = { type: "composer" };
      this.setProperties({ uploadProgress: 0, isUploading });
      return isUploading;
    });

    $element.on("fileuploadprogressall", (e, data) => {
      this.set("uploadProgress", parseInt(data.loaded / data.total * 100, 10));
    });

    $element.on("fileuploadsend", (e, data) => {
      this._validUploads++;
      // add upload placeholders (as much placeholders as valid files dropped)
      const placeholder = _.times(this._validUploads, () => uploadPlaceholder).join("\n");
      this._addText(this._getSelected(), placeholder);

      if (data.xhr && data.originalFiles.length === 1) {
        this.set("isCancellable", true);
        this._xhr = data.xhr();
      }
    });

    $element.on("fileuploadfail", (e, data) => {
      this._resetUpload(true);

      const userCancelled = this._xhr && this._xhr._userCancelled;
      this._xhr = null;

      if (!userCancelled) {
        Discourse.Utilities.displayErrorForUpload(data);
      }
    });

    this.messageBus.subscribe("/uploads/composer", upload => {
      // replace upload placeholder
      if (upload && upload.url) {
        if (!this._xhr || !this._xhr._userCancelled) {
          const markdown = Discourse.Utilities.getUploadMarkdown(upload);
          this.set('value', this.get('value').replace(uploadPlaceholder, markdown));
          this._resetUpload(false);
          this.set('dockedUpload', false)
        } else {
          this._resetUpload(true);
        }
      } else {
        this._resetUpload(true);
        Discourse.Utilities.displayErrorForUpload(upload);
      }
    });

    this._firefoxPastingHack();
  },

  @on('willDestroyElement')
  _unbindUploadTarget() {
    this._validUploads = 0;
    this.messageBus.unsubscribe("/uploads/composer");
    const $uploadTarget = this.$();
    try { $uploadTarget.fileupload("destroy"); }
    catch (e) { }
    $uploadTarget.off();
  },

  @computed
  toolbar() {
    const toolbar = new Toolbar(this.site);
    _createCallbacks.forEach(cb => cb(toolbar));
    return toolbar;
  },

  _applyEmojiAutocomplete(container, $editorInput) {
    if (!this.siteSettings.enable_emoji) { return; }

    const template = container.lookup('template:emoji-selector-autocomplete.raw');
    const self = this;

    $editorInput.autocomplete({
      template: template,
      key: ":",
      afterComplete(text) {
        self.set('value', text);
      },

      transformComplete(v) {
        if (v.code) {
          return `${v.code}:`;
        } else {
          showSelector({
            appendTo: self.$(),
            container,
            onSelect: title => {
              // Remove the previously type characters when a new emoji is selected from the selector.
              let selected = self._getSelected();
              let newPre = selected.pre.replace(/:[^:]+$/, ":");
              let numOfRemovedChars = selected.pre.length - newPre.length;
              selected.pre = newPre;
              selected.start -= numOfRemovedChars;
              selected.end -= numOfRemovedChars;
              self._addText(selected, `${title}:`);
            }
          });
          return "";
        }
      },

      dataSource(term) {
        return new Ember.RSVP.Promise(resolve => {
          const full = `:${term}`;
          term = term.toLowerCase();

          if (term === "") {
            return resolve(["slight_smile", "smile", "wink", "sunny", "blush"]);
          }

          if (Discourse.Emoji.translations[full]) {
            return resolve([Discourse.Emoji.translations[full]]);
          }

          const options = Discourse.Emoji.search(term, {maxResults: 5});

          return resolve(options);
        }).then(list => list.map(code => {
          return {code, src: Discourse.Emoji.urlFor(code)};
        })).then(list => {
          if (list.length) {
            list.push({ label: I18n.t("composer.more_emoji") });
          }
          return list;
        });
      }
    });
  },

  _getSelected(trimLeading) {
    if (!this.get('ready')) { return; }

    const textarea = this.$('textarea.d-editor-input')[0];
    const value = textarea.value;
    var start = textarea.selectionStart;
    let end = textarea.selectionEnd;

    // trim trailing spaces cause **test ** would be invalid
    while (end > start && /\s/.test(value.charAt(end-1))) {
      end--;
    }

    if (trimLeading) {
      // trim leading spaces cause ** test** would be invalid
      while(end > start && /\s/.test(value.charAt(start))) {
        start++;
      }
    }

    const selVal = value.substring(start, end);
    const pre = value.slice(0, start);
    const post = value.slice(end);

    return { start, end, value: selVal, pre, post };
  },

  _selectText(from, length) {
    Ember.run.scheduleOnce('afterRender', () => {
      const $textarea = this.$('textarea.d-editor-input');
      const textarea = $textarea[0];
      const oldScrollPos = $textarea.scrollTop();
      if (!this.capabilities.isIOS) {
        $textarea.focus();
      }
      textarea.selectionStart = from;
      textarea.selectionEnd = textarea.selectionStart + length;
      $textarea.scrollTop(oldScrollPos);
    });
  },

  // perform the same operation over many lines of text
  _getMultilineContents(lines, head, hval, hlen, tail, tlen) {
    let operation = OP.NONE;

    return lines.map(l => {
      if (l.length === 0) { return l; }

      if (operation !== OP.ADDED &&
          (l.slice(0, hlen) === hval && tlen === 0 || l.slice(-tlen) === tail)) {
        operation = OP.REMOVED;
        if (tlen === 0) {
          const result = l.slice(hlen);
          [hval, hlen] = getHead(head, hval);
          return result;
        } else if (l.slice(-tlen) === tail) {
          const result = l.slice(hlen, -tlen);
          [hval, hlen] = getHead(head, hval);
          return result;
        }
      } else if (operation === OP.NONE) {
        operation = OP.ADDED;
      } else if (operation === OP.REMOVED) {
        return l;
      }

      const result = `${hval}${l}${tail}`;
      [hval, hlen] = getHead(head, hval);
      return result;
    }).join("\n");
  },

  _applySurround(sel, head, tail, exampleKey) {
    const pre = sel.pre;
    const post = sel.post;

    const tlen = tail.length;
    if (sel.start === sel.end) {
      if (tlen === 0) { return; }

      const [hval, hlen] = getHead(head);
      const example = I18n.t(`composer.${exampleKey}`);
      this.set('value', `${pre}${hval}${example}${tail}${post}`);
      this._selectText(pre.length + hlen, example.length);
    } else {
      const lines = sel.value.split("\n");

      let [hval, hlen] = getHead(head);
      if (lines.length === 1 && pre.slice(-tlen) === tail && post.slice(0, hlen) === hval) {
        this.set('value', `${pre.slice(0, -hlen)}${sel.value}${post.slice(tlen)}`);
        this._selectText(sel.start - hlen, sel.value.length);
      } else {
        const contents = this._getMultilineContents(lines, head, hval, hlen, tail, tlen);

        this.set('value', `${pre}${contents}${post}`);
        if (lines.length === 1 && tlen > 0) {
          this._selectText(sel.start + hlen, contents.length - hlen - hlen);
        } else {
          this._selectText(sel.start, contents.length);
        }
      }
    }
  },

  _addText(sel, text) {
    const insert = `${sel.pre}${text}`;
    this.set('value', `${insert}${sel.post}`);
    this._selectText(insert.length, 0);
    Ember.run.scheduleOnce("afterRender", () => this.$("textarea.d-editor-input").focus());
  },

  // Believe it or not pasting an image in Firefox doesn't work without this code
  _firefoxPastingHack() {
    const uaMatch = navigator.userAgent.match(/Firefox\/(\d+)\.\d/);
    if (uaMatch && parseInt(uaMatch[1]) >= 24) {
      this.$().append( Ember.$("<div id='contenteditable' contenteditable='true' style='height: 0; width: 0; overflow: hidden'></div>") );
      this.$("textarea").off('keydown.contenteditable');
      this.$("textarea").on('keydown.contenteditable', event => {
        // Catch Ctrl+v / Cmd+v and hijack focus to a contenteditable div. We can't
        // use the onpaste event because for some reason the paste isn't resumed
        // after we switch focus, probably because it is being executed too late.
        if ((event.ctrlKey || event.metaKey) && (event.keyCode === 86)) {
          // Save the current textarea selection.
          const textarea = this.$("textarea")[0];
          const selectionStart = textarea.selectionStart;
          const selectionEnd = textarea.selectionEnd;

          // Focus the contenteditable div.
          const contentEditableDiv = this.$('#contenteditable');
          contentEditableDiv.focus();

          // The paste doesn't finish immediately and we don't have any onpaste
          // event, so wait for 100ms which _should_ be enough time.
          setTimeout(() => {
            const pastedImg  = contentEditableDiv.find('img');

            if ( pastedImg.length === 1 ) {
              pastedImg.remove();
            }

            // For restoring the selection.
            textarea.focus();
            const textareaContent = $(textarea).val(),
                startContent = textareaContent.substring(0, selectionStart),
                endContent = textareaContent.substring(selectionEnd);

            const restoreSelection = function(pastedText) {
              $(textarea).val( startContent + pastedText + endContent );
              textarea.selectionStart = selectionStart + pastedText.length;
              textarea.selectionEnd = textarea.selectionStart;
            };

            if (contentEditableDiv.html().length > 0) {
              // If the image wasn't the only pasted content we just give up and
              // fall back to the original pasted text.
              contentEditableDiv.find("br").replaceWith("\n");
              restoreSelection(contentEditableDiv.text());
            } else {
              // Depending on how the image is pasted in, we may get either a
              // normal URL or a data URI. If we get a data URI we can convert it
              // to a Blob and upload that, but if it is a regular URL that
              // operation is prevented for security purposes. When we get a regular
              // URL let's just create an <img> tag for the image.
              const imageSrc = pastedImg.attr('src');

              if (imageSrc.match(/^data:image/)) {
                // Restore the cursor position, and remove any selected text.
                restoreSelection("");

                // Create a Blob to upload.
                const image = new Image();
                image.onload = () => {
                  // Create a new canvas.
                  const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
                  canvas.height = image.height;
                  canvas.width = image.width;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(image, 0, 0);

                  canvas.toBlob(blob => this.$().fileupload('add', {files: blob}));
                };
                image.src = imageSrc;
              } else {
                restoreSelection("<img src='" + imageSrc + "'>");
              }
            }

            contentEditableDiv.html('');
          }, 100);
        }
      });
    }
  },

  actions: {
    toolbarButton(button) {
      const selected = this._getSelected(button.trimLeading);
      const toolbarEvent = {
        selected,
        applySurround: (head, tail, exampleKey) => this._applySurround(selected, head, tail, exampleKey),
        addText: text => this._addText(selected, text),
      };
      button.perform(toolbarEvent);
    },

    addText(text) {
      this._addText(this._getSelected(), text)
    },

    cancelUpload() {
      if (this._xhr) {
        this._xhr._userCancelled = true;
        this._xhr.abort();
      }
      this._resetUpload(true);
    },

    upload() {
      this.set('dockedUpload', true)
    },

    emoji() {
      showSelector({
        appendTo: this.$().parents('.messages-menu'),
        container: this.container,
        onSelect: title => this._addText(this._getSelected(), `:${title}:`)
      });
    }
  }

});
