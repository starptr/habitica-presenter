import type { PlasmoContentScript } from 'plasmo'

export const config: PlasmoContentScript = {
  matches: ["https://habitica.com/*"],
}

const parentSelectors = [".habit .sortable-tasks", ".daily .sortable-tasks"]; // Selector for element containing task list
const selector = ".task-wrapper > .type_habit .task-content, .task-wrapper > .type_daily .task-content"; // Selector for list of tasks

const defaultStyles = {
  task: {
    background: "#fff",
    titleColor: "rgb(52, 49, 58)",
    descriptionColor: "rgb(104, 98, 116)",
    counterColor: "rgb(165, 161, 172)",
  },
};

interface ElementsForStyling {
  title: HTMLParagraphElement | null;
  description: HTMLParagraphElement | null;
  images: NodeListOf<HTMLImageElement>;
  spans: NodeListOf<HTMLSpanElement>;
  svgs: NodeListOf<SVGElement>;
}
function queryElementsForStyling(taskElem: HTMLElement): ElementsForStyling {
  return {
    title: taskElem.querySelector("h3 > p"),
    description: taskElem.querySelector("div > p"),
    images: taskElem.querySelectorAll("img"),
    spans: taskElem.querySelectorAll("span"),
    svgs: taskElem.querySelectorAll("svg"),
  }
}
function censorTaskElem(elem: HTMLElement) {
  elem.style.background = "repeating-linear-gradient( 45deg, #fd3030, #fd3030 5px, #e5e5f7 5px, #e5e5f7 25px )";
  elem.style.backgroundColor = "#d5c8ff";

  const elemsForStyling = queryElementsForStyling(elem);
  // Make text transparent
  if (elemsForStyling.title !== null) {
    elemsForStyling.title.style.color = "transparent";
  }
  if (elemsForStyling.description !== null) {
    elemsForStyling.description.style.color = "transparent";
  }
  // Make emoji transparent
  for (const imageElem of elemsForStyling.images) {
    imageElem.style.opacity = "0";
  }

  // Hackily make counters transparent
  for (const spanElem of elemsForStyling.spans) {
    spanElem.style.color = "transparent";
  }
  for (const svgElem of elemsForStyling.svgs) {
    svgElem.style.color = "transparent";
  }
}
function restoreTaskElem(elem: HTMLElement) {
  elem.style.background = defaultStyles.task.background;
  
  const elemsForStyling = queryElementsForStyling(elem);
  if (elemsForStyling.title !== null) {
    elemsForStyling.title.style.color = defaultStyles.task.titleColor;
  }
  if (elemsForStyling.description !== null) {
    elemsForStyling.description.style.color = defaultStyles.task.descriptionColor;
  }

  for (const imageElem of elemsForStyling.images) {
    imageElem.style.opacity = "1";
  }

  for (const spanElem of elemsForStyling.spans) {
    spanElem.style.color = defaultStyles.task.counterColor;
  }
  for (const svgElem of elemsForStyling.svgs) {
    svgElem.style.color = defaultStyles.task.counterColor;
  }
}

function isElementSecretEmoji(elem: HTMLImageElement): boolean {
  return elem.src.endsWith("secret.png");
}
function isSecret(descriptionElem: HTMLElement): boolean {
  // Check for unicode emoji
  if (descriptionElem.innerText.trim().startsWith("㊙")) {
    return true;
  }

  // Check for embedded emoji image
  const emojiElem = descriptionElem.querySelector("img"); // Select the first image (emoji)
  // There exists an emoji
  if (emojiElem !== null) {
    // Task is secret!
    if (isElementSecretEmoji(emojiElem)) {
      return true;
    }
  }
  return false;
}

function handleListMaybeUpdated() {
  console.log("Body maybe updated");
  const taskElems = document.querySelectorAll(selector);
  if (taskElems.length === 0) {
    console.log("No matches for selector found");
    return;
  }
  for (const taskElem of taskElems) {
    const task = taskElem as HTMLElement;
    const descriptionElem = task.children[0].children[1].children[0]; // Select description paragraph

    // Task has description
    if (typeof descriptionElem !== 'undefined' && isSecret(descriptionElem as HTMLElement)) {
      censorTaskElem(task);
    } else {
      restoreTaskElem(task);
    }
  }
}

function handoffToFinerObserver() {
  console.log("Handoff start");
  const finerCallback = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      // Apply style only when list is modified
      if (mutation.type === 'childList') {
        const {target} = mutation;
        if (target.nodeType === Node.ELEMENT_NODE) {
          handleListMaybeUpdated();
        }
      }
    }
  };
  // Listen to multiple task lists
  parentSelectors.forEach(parentSelector => {
    const observerFine = new MutationObserver(finerCallback);
    const parent = document.querySelector(parentSelector);
    observerFine.observe(parent, {
      subtree: true,
      childList: true,
    });
  });
}

function main() {
  console.log("Running main");

  // Listen to top-level DOM changes
  // Only use `observerRough` until parent element of list exists
  const roughObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {

      const {target} = mutation;
      if (target.nodeType === Node.ELEMENT_NODE) {
        // Parent element now exists
        handoffToFinerObserver();
        // Handle race condition
        handleListMaybeUpdated();
        roughObserver.disconnect();
      }
    }
  });
  roughObserver.observe(document.body, {
    subtree: true,
    childList: true,
  });

  // Handle race condition where body was updated before event listener was attached
  handleListMaybeUpdated();
}
window.addEventListener("load", main);
