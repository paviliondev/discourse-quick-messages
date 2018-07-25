console.log("lib/docked-composer");

const getUsernames = function(participants) {
  let usernames = [];
  participants.forEach((participant) => {
    let username = participant.user ? participant.user.username : participant.username; 
    usernames.push(username);
  });
  return usernames;
};

const formatUsernames = function(usernames) {
  let formatted = '';
  let length = usernames.length;
  usernames.forEach((username, i) => {
    formatted += username;
    if (i < length - 1) {
      formatted += i === (length - 2) ? ' & ' : ', ';
    }
  });
  return formatted;
};

// based on discourse/lib/safari-hacks calcHeight

const calcHeightWithKeyboard = function() {

  // estimate 270 px for keyboard
  let withoutKeyboard = window.innerHeight - 270;
  const min = 270;

  // iPhone shrinks header and removes footer controls ( back / forward nav )
  // at 39px we are at the largest viewport
  const portrait = window.innerHeight > window.innerWidth;
  const smallViewport = ((portrait ? window.screen.height : window.screen.width) - window.innerHeight) > 40;

  if (portrait) {

    // iPhone SE, it is super small so just
    // have a bit of crop
    if (window.screen.height === 568) {
      withoutKeyboard = 270;
    }

    // iPhone 6/7/8
    if (window.screen.height === 667) {
      withoutKeyboard = smallViewport ? 295 : 325;
    }

    // iPhone 6/7/8 plus
    if (window.screen.height === 736) {
      withoutKeyboard = smallViewport ? 353 : 383;
    }

    // iPhone X
    if (window.screen.height === 812) {
      withoutKeyboard = smallViewport ? 340 : 370;
    }

    // iPad can use innerHeight cause it renders nothing in the footer
    if (window.innerHeight > 920) {
      withoutKeyboard -= 45;
    }

  } else {

    // landscape
    // iPad, we have a bigger keyboard
    if (window.innerHeight > 665) {
      withoutKeyboard -= 128;
    }
  }

  // iPad portrait also has a bigger keyboard
  return Math.max(withoutKeyboard, min);
};

export { getUsernames, formatUsernames, calcHeightWithKeyboard };
