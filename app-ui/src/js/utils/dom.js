export const select = (selector, parent = document) => parent.querySelector(selector);

export const selectAll = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));

export const create = (tagName, options = {}) => {
  const element = document.createElement(tagName);
  Object.keys(options).forEach(key => {
    if (key === 'class') {
      element.className = options[key];
    } else if (key === 'id') {
      element.id = options[key];
    } else if (key === 'dataset') {
      Object.keys(options[key]).forEach(dataKey => {
        element.dataset[dataKey] = options[key][dataKey];
      });
    } else {
      element.setAttribute(key, options[key]);
    }
  });
  return element;
};

export const appendChildren = (parent, children) => {
  children.forEach(child => {
    if (child) parent.appendChild(child);
  });
};

export const removeChildren = (parent) => {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
};
