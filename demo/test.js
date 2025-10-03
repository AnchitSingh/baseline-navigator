// Widely Supported Features
const promise = new Promise((resolve) => {
    resolve('done');
});

promise.then(result => console.log(result)).catch(err => console.error(err));

// Fetch API
fetch('/api/data')
    .then(response => response.json())
    .then(data => console.log(data));

// Array methods
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const evens = numbers.filter(n => n % 2 === 0);
const sum = numbers.reduce((acc, n) => acc + n, 0);
const hasThree = numbers.includes(3);

// Optional chaining & nullish coalescing
const user = {
    profile: {
        name: 'John'
    }
};

const name = user?.profile?.name ?? 'Anonymous';
const email = user?.profile?.email ?? 'no email';

// Destructuring
const [first, second] = [1, 2];
const { name: userName } = user.profile;

// ES Modules syntax (if in a module context)
// import { helper } from './utils';

// Limited Support Features
// Intersection Observer
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            console.log('Element is visible');
        }
    });
});

// Custom Elements (Web Components)
class CustomElement extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
}

customElements.define('custom-element', CustomElement);

// CSS :has() selector in JavaScript (using querySelector)
const elementsWithChild = document.querySelectorAll('.parent:has(.child)');

// Modern CSS features
const element = document.querySelector('.target');
element.style.cssText = `transform: translateX(100px);`;