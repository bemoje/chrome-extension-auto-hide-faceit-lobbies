// run inside the scope of an immediately invoked anonymous function to avoid polluting the global namespace
(function () {
   // application state
   let hiddenLobbies = [];
   let shiftKeyDown = false;
   let hideEnabled = false;

   // user options
   let hideNotJoinable = true;
   let hideNotReady = true;
   let hidePlaying = true;
   let hideQueuing = true;
   let enabledOnPageLoad = true;
   let outputDebuggingMessages = false;

   // console outputs debuggning message if enabled
   const debug = (message) => {
      const source = 'AHFL debugging output';
      if (outputDebuggingMessages) {
         if (typeof message !== 'object') {
            message = {message};
         }
         message['source'] = source;
         console.log(message);
      }
   };

   // rate at which hide/show updates (milliseconds)
   const REFRESH_RATE_MS = 3000;

   // assumed appropriate delay until dom has loaded (milliseconds)
   const AWAIT_DOM_LOAD_MS = 7000;

   // lobby status enum
   const STATUS = {
      NOT_JOINABLE: 'Not joinable',
      NOT_READY: 'Not ready',
      PLAYING: 'Playing',
      QUEUING: 'Queuing',
      READY: 'Ready'
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
   setTimeout(function () {
      const STATUS_CLASS_NAME = 'sc-igsHvH bAyDlA';

      // find lobby html element class names. faceit obfuscates and sometimes change the class names. We can determine
      // the html class name of lobby elements by finding some text strings inside span elements that we know must
      // originate from inside a lobby element
      const LOBBY_CLASS_NAME = (function () {
         const count = {};
         const searchStrings = Object.values(STATUS);
         const spanElements = document.getElementsByTagName("span");
         for (const span of spanElements) {
            for (const str of searchStrings) {
               if (span.innerHTML === str) {
                  // the 8x grandparent of the span element matching the search will be the lobby element
                  let lobby = span.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
                  // Sometimes the lobby element is found some levels higher (8x grandparent or more) in the DOM tree.
                  // We know that the parent of the lobby element has many child elements, and that lobby elements
                  // children many levels down only have a single child element. We can use this to identify the lobby
                  // element.
                  if (spanElements.length > 1) {
                     while (lobby.parentElement.childNodes.length === 1) {
                        lobby = lobby.parentElement;
                     }
                  }
                  // update count
                  const className = lobby.getAttribute('class');
                  if (Number.isInteger(count[className])) {
                     count[className]++;
                  } else {
                     count[className] = 1;
                  }
                  debug({spanInnerHTML: span.innerHTML});
                  break;
               }
            }
         }
         // return class name with most occurances
         const max = {className: "", count: 0};
         for (const className in count) {
            if (count[className] >= max.count) {
               max.className = className;
               max.count = count[className];
            }
         }
         debug({count});
         debug({max});
         return max.className;
      })();

      /**
       * Determines whether a given lobby html element has a given status
       * @param {HTMLElement} lobby - the lobby element
       * @param {string} status - a STATUS enum value
       * @return {boolean}
       */
      function lobbyHasStatusOf (lobby, status) {
         return lobby.getElementsByClassName(STATUS_CLASS_NAME)[0].innerHTML === status;
      }

      /**
       * Hide all lobbies based on user options
       * @return {void}
       */
      function hideLobbies () {
         for (const lobby of document.getElementsByClassName(LOBBY_CLASS_NAME)) {
            if (
               (hideNotJoinable && lobbyHasStatusOf(lobby, STATUS.NOT_JOINABLE)) ||
               (hideNotReady && lobbyHasStatusOf(lobby, STATUS.NOT_READY)) ||
               (hidePlaying && lobbyHasStatusOf(lobby, STATUS.PLAYING)) ||
               (hideQueuing && lobbyHasStatusOf(lobby, STATUS.QUEUING))
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
       * Initializes the application. Invoked immediately.
       * @return {void}
       */
      (function initialize () {
         // load extension user options from chrome.storage (async)
         chrome.storage.sync.get([
            'ahfl_hideNotJoinable',
            'ahfl_hideNotReady',
            'ahfl_hidePlaying',
            'ahfl_hideQueuing',
            'ahfl_enabledOnPageLoad',
            'ahfl_outputDebuggingMessages'
         ], (options) => {
            // override default user options
            if (options.ahfl_hideNotJoinable !== undefined) hideNotJoinable = options.ahfl_hideNotJoinable;
            if (options.ahfl_hideNotReady !== undefined) hideNotReady = options.ahfl_hideNotReady;
            if (options.ahfl_hidePlaying !== undefined) hidePlaying = options.ahfl_hidePlaying;
            if (options.ahfl_hideQueuing !== undefined) hideQueuing = options.ahfl_hideQueuing;
            if (options.ahfl_enabledOnPageLoad !== undefined) enabledOnPageLoad = options.ahfl_enabledOnPageLoad;
            if (options.ahfl_outputDebuggingMessages !== undefined) outputDebuggingMessages = options.ahfl_outputDebuggingMessages;
            debug({userOptionsLoadedFromChromeStorage: {hideNotJoinable, hideNotReady, hidePlaying, hideQueuing, enabledOnPageLoad, outputDebuggingMessages}});
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
               // 'SHIFT + HOME' key combination registered
               hideLobbies();
               hideEnabled = true;
               debug(hiddenLobbies.length + ' lobbies were hidden.');
            } else if (shiftKeyDown && event.key === 'End') {
               // 'SHIFT + END' key combination registered
               hideEnabled = false;
               unhideLobbies();
               debug('Showing all lobbies.');
            }
         });

         // auto-refresh on a time interval in case lobby status changes
         window.setInterval(() => {
            if (hideEnabled) {
               unhideLobbies();
               hideLobbies();
            }
         }, REFRESH_RATE_MS);

         // hide lobbies on page load if enabled
         if (enabledOnPageLoad) {
            window.setTimeout(() => {
               hideLobbies();
               hideEnabled = true;
               debug(hiddenLobbies.length + ' lobbies were hidden.');
            }, 500);
         }
      })();
   }, AWAIT_DOM_LOAD_MS);
})();
