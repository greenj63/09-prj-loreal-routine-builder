// Import chat messaging functionality
import {
  startConversation,
  sendSystemMessage,
  sendMessage,
  regenerateMessages,
} from "./chatbot.js";

/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const chatInput = document.getElementById("userInput");
const generateRoutineBtn = document.getElementById("generateRoutine");

// OpenAI fetch location
const workerURL = "https://loreal-chatbot.jgreene6801.workers.dev/";

// Message history
const messages = localStorage.getItem("chatHistory") || [];

// Selected products (store minimal product objects)
let selectedProducts = [];

// localStorage key
const STORAGE_KEY = "loreal_selected_products";

// Startup message
const startupMsg =
  "Welcome! Feel free to ask for advice on products, routines, and more!";

// On load, restore any saved selections
loadSavedSelections();
displaySelectedProducts();
updateGenerateGlow();
regenerateMessages(startupMsg);

// --- RTL autodetection ---------------------------------------------------
const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "ps", "sd", "ug", "dv"]);

function applyDirection(isRtl) {
  const html = document.documentElement;
  if (isRtl) html.setAttribute("dir", "rtl");
  else html.setAttribute("dir", "ltr");
}

function detectAndApplyRTL() {
  // Prefer explicit lang on the document
  let lang = (document.documentElement.getAttribute("lang") || "").trim();
  if (!lang) {
    // Fallback to browser language
    lang = navigator.language || navigator.userLanguage || "";
  }
  const primary = lang.split(/[-_]/)[0].toLowerCase();
  const isRtl = RTL_LANGS.has(primary);
  applyDirection(isRtl);
}

// Run RTL support on load
detectAndApplyRTL();

// Watch for lang attribute changes (e.g., browser translate tools)
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type === "attributes" && m.attributeName === "lang") {
      detectAndApplyRTL();
      break;
    }
  }
});
observer.observe(document.documentElement, { attributes: true });
// -------------------------------------------------------------------------

// Current active filters
let currentCategory = "";
let currentSearch = "";

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", (e) => {
  currentCategory = e.target.value;
  refreshProducts();
});

// Live search: filter as the user types
if (productSearch) {
  productSearch.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim().toLowerCase();
    refreshProducts();
  });
}

// Refresh product grid using current filters
async function refreshProducts() {
  const products = await loadProducts();

  // If no category is selected, don't show search-only results — prompt user to pick a category
  if (!currentCategory) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  let result = products.filter((p) => p.category === currentCategory);

  if (currentSearch) {
    const term = currentSearch;
    result = result.filter((p) => {
      const hay = `${p.name} ${p.brand} ${p.description || ""}`.toLowerCase();
      return hay.indexOf(term) !== -1;
    });
  }

  if (!result || result.length === 0) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products found.</div>`;
    return;
  }

  displayProducts(result);
  addProductListeners();
}

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  // Send the message to the chatbot
  sendMessage();
});

/* Generate a routine handler - sends product list for personalized routine */
generateRoutineBtn.addEventListener("click", async () => {
  // Create a new list with product details
  const productDetails = await getSelectedDetails();

  // Convert product details array to a JSON string and store in detailsMsg
  const detailsMsg = JSON.stringify(productDetails);
  console.log(productDetails, detailsMsg);

  // Send these products to the AI
  const msg = `Here is the most recent product list in JSON format: 
  ${detailsMsg}
  When the user asks you to generate a routine in the next message, reference these products.`;
  console.log(msg);
  sendSystemMessage(msg);

  // Send a message by the user to inform the AI to generate a routine
  sendMessage("Generate a routine with my selected products");
});

// Returns a list of selected products with their name, brand, and description
async function getSelectedDetails() {
  // Load full product list once
  const productList = await loadProducts();

  // Map selected products into detailed objects
  const productDetails = await Promise.all(
    selectedProducts.map(async (product) => {
      const { id, name, brand } = product;
      const found = productList.find((p) => String(p.id) === String(id));
      const description = found ? found.description : "";
      return { name, brand, description };
    }),
  );

  return productDetails;
}

// Update generate button glow based on selections
function updateGenerateGlow() {
  const gen = document.getElementById("generateRoutine");
  if (!gen) return;
  if (selectedProducts && selectedProducts.length > 0)
    gen.classList.add("glowing");
  else gen.classList.remove("glowing");
}

// Load saved selections from localStorage
function loadSavedSelections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) selectedProducts = JSON.parse(raw);
  } catch (e) {
    selectedProducts = [];
  }
}

// Save selections to localStorage
function saveSelections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProducts));
  updateGenerateGlow();
}

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = generateProductHTML(products);

  // mark cards that are already selected
  productsContainer.querySelectorAll(".product-card").forEach((el) => {
    const id = el.dataset.id;
    if (selectedProducts.find((p) => p.id === id)) el.classList.add("selected");
  });
}

// Adds a product to the selected products list
function productClicked(id) {
  const productEl = productsContainer.querySelector(`[data-id="${id}"]`);
  if (!productEl) return;

  const name = productEl.querySelector("h3").textContent;
  const brand = productEl.querySelector("p").textContent;
  const image = productEl.querySelector("img").src;

  const exists = selectedProducts.find((p) => p.id === id);

  if (exists) {
    // remove
    selectedProducts = selectedProducts.filter((p) => p.id !== id);
    productEl.classList.remove("selected");
  } else {
    // add
    selectedProducts.push({ id, name, brand, image });
    productEl.classList.add("selected");
  }

  saveSelections();
  displaySelectedProducts();

  // update overlay button label for this product
  const overlayBtn = productEl.querySelector(".select-btn");
  if (overlayBtn) overlayBtn.textContent = exists ? "Select" : "Remove";

  // if modal is open for this product, update modal select button label
  const modal = document.getElementById("productModal");
  if (modal) {
    const modalSelect = modal.querySelector(".modal-select");
    if (modalSelect) modalSelect.textContent = exists ? "Select" : "Remove";
  }
}

// Generate HTML for each selected product and put it on the page
function displaySelectedProducts() {
  if (!selectedProducts || selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<div class="empty-selected">Add products to get started</div>`;
    return;
  }

  // Create a semantic list container and populate with selected items
  const ul = document.createElement("ul");
  ul.className = "selected-items-list";
  ul.innerHTML = selectedProducts
    .map(
      (p) =>
        `<li data-id="${p.id}" class="selected-item"><img src="${p.image}" alt="${p.name}"><div><strong>${p.name}</strong><div>${p.brand}</div></div></li>`,
    )
    .join("");

  // Replace contents of the container with the new ul
  selectedProductsList.innerHTML = "";
  selectedProductsList.appendChild(ul);

  // Add associated listeners
  addSelectedListeners();
}

// Remove all selected products
function removeAllSelections() {
  // remove selected class from all products
  selectedProducts.forEach(({ id }) => {
    removeSelected(id);
  });
}

// wire remove all button
const removeAllBtn = document.getElementById("removeAll");
if (removeAllBtn) {
  removeAllBtn.addEventListener("click", () => {
    removeAllSelections();
  });
}

// Adds listeners to product overlay buttons
function addProductListeners() {
  productsContainer.querySelectorAll(".product-card").forEach((product) => {
    // HTML elements
    const selectBtn = product.querySelector(".select-btn");
    const learnBtn = product.querySelector(".learn-more");

    // Learn more button listener
    learnBtn.addEventListener("click", () => {
      toggleModal(product.dataset.id);
    });

    // set initial label based on selection state
    const isSelected = selectedProducts.find(
      (p) => p.id === product.dataset.id,
    );
    selectBtn.textContent = isSelected ? "Remove" : "Select";

    // Select button listener
    selectBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      productClicked(product.dataset.id);
    });
  });
}

// Adds listeners to the selected products section
function addSelectedListeners() {
  selectedProductsList.querySelectorAll(".selected-item").forEach((product) => {
    product.addEventListener("click", () => {
      removeSelected(product.dataset.id);
    });
  });
}

// Removes a product from the selected products list and
// updates elements on the page
function removeSelected(id) {
  // Remove from selected products list
  selectedProducts = selectedProducts.filter((p) => p.id !== id);

  // Undo highlight in category search
  const catEl = productsContainer.querySelector(`[data-id="${id}"]`);
  if (catEl) {
    catEl.classList.remove("selected");
    const overlayBtn = catEl.querySelector(".select-btn");
    if (overlayBtn) overlayBtn.textContent = "Select";
  }

  // if modal is open for this product, update its select button label
  const modal = document.getElementById("productModal");
  if (modal) {
    const modalId = modal.querySelector(".modal-card")?.dataset?.id;
    // modal in this app doesn't have data-id on card, so compare by passed id
    const modalSelect = modal.querySelector(".modal-select");
    if (modalSelect) modalSelect.textContent = "Select";
  }
  // Update selected products display
  saveSelections();
  displaySelectedProducts();
  updateGenerateGlow();
}

// Toggle product detail modal. If id provided, open modal for that product. If no id, close.
async function toggleModal(id) {
  // If modal exists and no id, close it
  const existing = document.getElementById("productModal");
  if (!id) {
    if (existing) {
      // restore focus to previously focused element
      const prev = existing._previousActiveElement;
      existing.remove();
      if (prev && typeof prev.focus === "function") prev.focus();
    }
    return;
  }

  // Load product data
  const products = await loadProducts();
  const product = products.find((p) => String(p.id) === String(id));
  if (!product) return;

  // remove any existing modal
  if (existing) existing.remove();

  // store reference to previously focused element so we can restore focus later
  const prevActive = document.activeElement;

  // build modal
  const modal = document.createElement("div");
  modal.id = "productModal";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <button class="modal-close" aria-label="Close">✕</button>
      <div class="modal-body">
        <div class="modal-image"><img src="${product.image}" alt="${product.name}"></div>
        <div class="modal-content">
          <h3>${product.name}</h3>
          <p class="modal-brand">${product.brand}</p>
          <p class="modal-desc">${product.description || "No description available."}</p>
          <div class="modal-actions">
            <button class="overlay-btn select-btn modal-select">Select</button>
            <button class="overlay-btn learn-more modal-close-cta">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // close handlers
  modal.querySelectorAll(".modal-close, .modal-close-cta").forEach((btn) => {
    btn.addEventListener("click", () => toggleModal());
  });

  // select handler in modal
  const sel = modal.querySelector(".modal-select");
  // set initial label based on selection
  const isSelected = selectedProducts.find(
    (p) => String(p.id) === String(product.id),
  );
  if (sel) sel.textContent = isSelected ? "Remove" : "Select";
  sel.addEventListener("click", (e) => {
    e.stopPropagation();
    productClicked(String(product.id));
    // update button text to reflect selection
    toggleModal();
  });

  // move focus into the modal for accessibility
  const closeBtn = modal.querySelector(".modal-close");
  if (closeBtn) closeBtn.focus();

  // attach previous active element to modal for restoration when closed
  modal._previousActiveElement = prevActive;

  // close when clicking outside card
  modal.addEventListener("click", (e) => {
    if (e.target === modal) toggleModal();
  });

  document.body.appendChild(modal);
}

// Generates product HTML for a list of products
function generateProductHTML(productList) {
  return productList
    .map(
      (product) => `
      <div class="product-card" data-id="${product.id}">
        <div class="product-media">
          <img src="${product.image}" alt="${product.name}">
          <div class="card-overlay">
            <button class="overlay-btn learn-more">Learn More</button>
            <button class="overlay-btn select-btn">Select</button>
          </div>
        </div>
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
        </div>
      </div>
    `,
    )
    .join("");
}
