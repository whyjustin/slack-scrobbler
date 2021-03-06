(function(window, $, storage) {
  'use strict';

  window.SlackScrobbler = function(service) {
    var me = this;
    var initialized = false;

    function checkSong(previousSong) {
      me.isCorrectFrame(me.service, me.options, function(correctFrame) {
        if (correctFrame) {
          initialized = true;
          me.isSongBeginning(me.service, me.options, function(beginning) {
            if (!beginning) {
              me.isSongReady(me.service, me.options, function(songReady) {
                if (songReady) {
                  me.isSameSong(me.service, me.options, previousSong, function(sameSong) {
                    if (!sameSong) {
                      me.getSong(me.service, me.options, function(song) {
                        me.isEmptySong(song, function(emptySong) {
                          if (!emptySong) {
                            var toStore = {};
                            toStore[service + '-song'] = song;

                            storage.set(toStore, function() {
                              $.post(me.options.slack.webhook, JSON.stringify(getJson(me.options, song)));
                              resetTimeout(song);
                            });
                          }
                        });
                      });
                    } else {
                      resetTimeout(previousSong);
                    }
                  });
                } else {
                  resetTimeout(previousSong);
                }
              });
            } else {
              resetTimeout(previousSong);
            }
          });
        } else {
          if (!initialized) {
            resetTimeout(previousSong);
          }
        }
      });
    }

    function resetTimeout(previousSong) {
      setTimeout(function() {
        checkSong(previousSong);
      }, 1000);
    }

    me.run = function() {
      storage.get('options', function(stored) {
        if (!stored.options) {
          console.error('Slack Music Notifier requires options to be set before use.');
        }
        if (!stored.options[service].enabled) {
          console.log('Slack Music Notifier is disabled for ' + service + '.');
        }

        me.service = service;
        me.options = stored.options;

        storage.get(service + '-song', function(stored) {
          var previousSong = stored[service + '-song'];
          checkSong(previousSong);
        });
      });
    }
  }

  SlackScrobbler.prototype.isCorrectFrame = function(service, options, callback) {
    callback(true);
  };

  SlackScrobbler.prototype.isSongBeginning = function(service, options, callback) {
    var element = $(options[service].playtime);
    if (element && element.text()) {
      var currentPlayTime = element.text();
      var playTimeSecs = hmsToSecondsOnly(currentPlayTime);
      callback(!playTimeSecs || playTimeSecs < 15);
    } else {
      callback(false);
    }
  };

  SlackScrobbler.prototype.isSongReady = function(service, options, callback) {
    callback(true);
  };

  SlackScrobbler.prototype.isEmptySong = function(song, callback) {
    callback(isEmptyOrSpaces(song.artist) && isEmptyOrSpaces(song.album) && isEmptyOrSpaces(song.title));
  };

  SlackScrobbler.prototype.getUid = function(service, options) {
    var artist = $(options[service].artist).text();
    var album = $(options[service].album).text();
    var title = $(options[service].title).text();
    return artist + album + title;
  }

  SlackScrobbler.prototype.isSameSong = function(service, options, previousSong, callback) {
    callback(!!previousSong && this.getUid(service, options) == previousSong.uid);
  };

  SlackScrobbler.prototype.getSong = function(service, options, callback) {
    var artist = $(options[service].artist).text();
    var album = $(options[service].album).text();
    var title = $(options[service].title).text();
      
    var song = {
      artist: artist,
      album: album,
      title: title,
      cover: getAlbumArt($(options[service].cover))
    }

    song.uid = this.getUid(service, options);

    callback(song);
  };

  function getAlbumArt(element) {
    if (element.prop('src')) {
      return element.prop('src');
    }
    else if (element.css('background-image')) {
      var background = element.css('background-image');
      return background.replace('url(', '').replace(')', '');
    }
  }

  function isEmptyOrSpaces(string) {
    return typeof string == 'undefined' || string === null || string.match(/^ *$/) !== null;
  }

  function hmsToSecondsOnly(str) {
    var p = str.split(':'),
        s = 0, m = 1;

    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }

    return s;
  }

  function getJson(options, song) { 
    if (options.slack.attachment) {
      return {
        'username' : options.slack.username,
        'icon_url' : song.cover,
        "mrkdwn" : true,
        "attachments": [
          {
            "fallback": song.title + ' - ' + song.artist + ' - ' + song.album,
            "title": song.title,
            "title_link": song.url,
            "text": song.artist + ' - ' + song.album,
            "thumb_url": song.cover
          }
        ]
      }
    } else {
      return {
        'username' : options.slack.username,
        'icon_url' : song.cover,
        "mrkdwn" : true,
        'text' : '*' + song.title + '*\n' + song.artist + ' - ' + song.album
      }
    }
  }
}(window, $, chrome.storage.local));