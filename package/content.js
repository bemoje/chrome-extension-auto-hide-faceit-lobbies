// after page load, run inside the scope of an immediately invoked function to avoid polluting the global namespace
window.addEventListener('load', () => {
   // assumed appropriate delay until dom has loaded (milliseconds)
   const AWAIT_DOM_LOAD_MS = 3805;

   // rate at which hide/show updates (milliseconds)
   const REFRESH_RATE_MS = 3000;

   // lobby status enum
   const STATUS = {
      NOT_JOINABLE: 'Not joinable',
      NOT_READY: 'Not ready',
      PLAYING: 'Playing',
      QUEUING: 'Queuing',
      READY: 'Ready'
   };

   // html class name enum (values set/overidden when application initializes)
   const CLASS_NAMES = {
      STATUS: 'sc-igsHvH bAyDlA',
      LOBBY: undefined
   };

   // non persistent application state
   let hiddenLobbies = [];
   let shiftKeyDown = false;
   let initializeSuccessful = false;

   // persistent application state: user options (syncs with chrome.storage)
   const options = {
      enabled: true,
      hideNotJoinable: true,
      hideNotReady: true,
      hidePlaying: true,
      hideQueuing: true,
      outputDebuggingMessages: false,
   };

   // console outputs debuggning message if enabled
   const debug = (message) => {
      if (options.outputDebuggingMessages) {
         console.log(message);
      }
   };

   /**
    * class for storing DOM data about hidden lobbies
    */
   class HiddenLobby {
      /**
       * @property {HTMLElement} element - the lobby element to store
       */
      element;

      /**
       * @property {string} display - a copy of the lobby element's original style.display value
       */
      originalDisplayValue;

      /**
       * @param {HTMLElement} element - the lobby element to store
       */
      constructor (element) {
         this.element = element;
         this.originalDisplayValue = element.style.display;
      }

      /**
       * Unhide the lobby
       * @return {void}
       */
      unhide () {
         this.element.style.display = this.originalDisplayValue;
      }
   }

   // start application after a delay
   window.setTimeout(() => {
      /**
       * Finds status- and lobby html element class names. faceit obfuscates and sometimes change the class names. We can
       * determine the html class name of lobby elements by finding some text strings inside span elements that we know
       * must originate from inside a lobby element.
       */
      function initializeClassNames () {
         const incrementClassCount = (count, element) => {
            const className = element.getAttribute('class');
            if (Number.isInteger(count[className])) {
               count[className]++;
            } else {
               count[className] = 1;
            }
         };

         const findLobbyElementFromStatusElement = (status, spanElements) => {
            // the 8x grandparent of the span element matching the search will be the lobby element
            let lobby = status.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
            // Sometimes the lobby element is found some levels higher (8x grandparent or more) in the DOM tree.
            // We know that the parent of the lobby element has many child elements, and that lobby elements
            // children many levels down only have a single child element. We can use this to identify the lobby
            // element.
            if (spanElements.length > 1) {
               while (lobby.parentElement.childNodes.length === 1) {
                  lobby = lobby.parentElement;
               }
            }
            return lobby;
         };

         const maxOccuringClassName = (count) => {
            const result = {className: "", count: 0};
            for (const className in count) {
               if (count[className] >= result.count) {
                  result.className = className;
                  result.count = count[className];
               }
            }
            return result;
         };

         // determine class names
         const countStatus = {};
         const countLobbies = {};
         const searchStrings = Object.values(STATUS);
         const spanElements = document.getElementsByTagName("span");
         if (spanElements.length > 0) {
            for (const status of spanElements) {
               for (const str of searchStrings) {
                  if (status.innerHTML === str) {
                     // count span element class names
                     incrementClassCount(countStatus, status);
                     // count lobby element class names
                     incrementClassCount(countLobbies, findLobbyElementFromStatusElement(status, spanElements));
                     debug({spanInnerHTML: status.innerHTML});
                     break;
                  }
               }
            }
            const maxStatus = maxOccuringClassName(countStatus);
            const maxLobby = maxOccuringClassName(countLobbies);
            // override enum values for CLASS_NAMES.STATUS only if any were found
            CLASS_NAMES.STATUS = maxStatus.className;
            CLASS_NAMES.LOBBY = maxLobby.className;
            initializeSuccessful = true;
            debug({CLASS_NAMES, countStatus, countLobbies});
         } else {
            // if no span elements were found, we cannot initialize the application. Retry in 3 seconds.
            window.setTimeout(() => {
               initializeClassNames();
            }, 3000);
         }
      }

      /**
       * Hide all lobbies based on user options
       * @return {void}
       */
      function hideLobbies () {
         //Determines whether a given lobby html element has a given status
         const lobbyHasStatusOf = (lobby, status) => {
            return lobby.getElementsByClassName(CLASS_NAMES.STATUS)[0].innerHTML === status;
         };
         // hide lobbies
         for (const lobby of document.getElementsByClassName(CLASS_NAMES.LOBBY)) {
            if (
               (options.hideNotJoinable && lobbyHasStatusOf(lobby, STATUS.NOT_JOINABLE)) ||
               (options.hideNotReady && lobbyHasStatusOf(lobby, STATUS.NOT_READY)) ||
               (options.hidePlaying && lobbyHasStatusOf(lobby, STATUS.PLAYING)) ||
               (options.hideQueuing && lobbyHasStatusOf(lobby, STATUS.QUEUING))
            ) {
               // store lobby element and a copy of its original style.display value
               hiddenLobbies.push(new HiddenLobby(lobby));

               // hide lobby
               lobby.style.display = 'none';
            }
         }
      }

      /**
       * Unhide all previously hidden lobbies
       * @return {void}
       */
      function unhideLobbies () {
         for (const hiddenLobby of hiddenLobbies) {
            hiddenLobby.unhide();
         }
         hiddenLobbies = [];
      }

      /**
       * Enables or disables the extension and stores this preference to chrome.storage so enabled status is remembered
       * whenever the page reloads.
       * @param {boolean} enabled - Whether to enable or disable the extension
       * @return {void}
       */
      function setEnabled (enabled) {
         options.enabled = enabled;
         // Save enabled status in chrome.storage (synchronous)
         chrome.storage.sync.set({options}, () => {
            debug({chromeStorageSaveResult: 'success', enabled: options.enabled});
         });
      }

      /**
       * Initializes the application. Invoked immediately.
       * @return {void}
       */
      (function initialize () {
         initializeClassNames();

         // load extension user options from chrome.storage (synchronous)
         chrome.storage.sync.get('options', (data) => {
            // override default user options
            Object.assign(options, data.options);
            debug({chromeStorageGet: data.options});
         });

         // if user changes options on options page, update application state
         chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes.options?.newValue) {
               Object.assign(options, changes.options.newValue);
               debug({chromeStorageChange: changes.options.newValue});
            }
         });

         // keyboard event listeners
         window.addEventListener('keydown', (event) => {
            if (event.key === 'Shift') {
               // 'SHIFT' key pressed
               shiftKeyDown = true;
            }
         });

         window.addEventListener('keyup', (event) => {
            if (event.key === 'Shift') {
               // 'SHIFT' key released
               shiftKeyDown = false;
            } else if (shiftKeyDown && event.key === 'Home') {
               // 'SHIFT + HOME' key combination registered. Toggle enabled on/off
               if (initializeSuccessful) {
                  if (options.enabled) {
                     // disable
                     setEnabled(false);
                     unhideLobbies();
                     debug('Showing all lobbies.');
                  } else {
                     // enable
                     hideLobbies();
                     setEnabled(true);
                     debug(hiddenLobbies.length + ' lobbies were hidden.');
                  }
               } else {
                  debug('Application not yet initialized successfully due to missing lobbies.');
               }
            }
         });

         // auto-refresh on a time interval in case lobby status changes
         window.setInterval(() => {
            if (initializeSuccessful) {
               if (options.enabled) {
                  unhideLobbies();
                  hideLobbies();
                  debug('Refreshed show/hide state. ' + hiddenLobbies.length + ' lobbies are hidden.');
               } else {
                  unhideLobbies();
               }
            } else {
               debug('Application not yet initialized successfully due to missing lobbies.');
            }
         }, REFRESH_RATE_MS);
      })();
   }, AWAIT_DOM_LOAD_MS);
});
