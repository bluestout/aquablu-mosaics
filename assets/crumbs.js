// Previous page button
if (document.querySelector(".btn-go-back")) {
    document.querySelector(".btn-go-back").addEventListener('click', () => {
        window.history.back();
    })
}

// START HERE
// Selecting the breadcrumb container
// This is using a bootstrap class, you can use your custom styles
var crumbContainer = document.querySelector(".history-breadcrumb");
const indexPageName = 'Homepage'; // Change this to whatever you want your homapge to be called
const maxCrumbLen = 10; // Change this to your need, shows 3 previous path by default
// Initiates the breadcrumb rendering
initBreadCrumb();
// Change the markup if you want in the createCrumbMarkup function

function initBreadCrumb() {
    // Just ignoring home page for the example, You can use add to the homepage if you want
    // Remove container from homepage if you don't want breadcrumbs in homepage
    if (crumbContainer) {
        // Currently using a data from page 
        let pageName = crumbContainer.dataset.breadcrumbLabel;
        console.log(">>> breadcrumbs page:" + pageName);
        let pageTemplate = crumbContainer.dataset.pageTemplate;
        console.log(">>> breadcrumbs template:" + pageTemplate);
        let pageSuffix = crumbContainer.dataset.pageSuffix;
        console.log(">>> breadcrumbs Suffix:" + pageSuffix);
        // You are Free to use link
        // let pageName = location.href;

        // Add a return keyword in the next statement to stop rendring crumb in home page
        // Remove container from Home page also
        /*
        if (!pageName || pageName === indexPageName) {
            initHomeCrumb();
            
            return;
        }
        */
        initHomeCrumb();
        let crumbList = localStorage.getItem('crumbList');
        crumbList = JSON.parse(crumbList)

        if ( pageTemplate == "page" ){
            let page_crumb = createCrumb(pageName);
            localStorage.setItem('crumbPage', JSON.stringify(page_crumb));
            crumbList.push(page_crumb);
        } else if ( pageTemplate == "collection"){
            let page_crumb = localStorage.getItem('crumbPage');
            if ( page_crumb ){
                const pageObj = JSON.parse(page_crumb);
                crumbList.push(pageObj);
            }

            let collection_crumb = createCrumb(pageName);
            localStorage.setItem('crumbCollection', JSON.stringify(collection_crumb));
            crumbList.push(collection_crumb);
        } else if ( pageTemplate == "product"){
            let page_crumb = localStorage.getItem('crumbPage');
            if ( page_crumb ){
                const pageObj = JSON.parse(page_crumb);
                crumbList.push(pageObj);
            }

            let collection_crumb = localStorage.getItem('crumbCollection');
            if ( collection_crumb ){
                const collectionObj = JSON.parse(collection_crumb);
                crumbList.push(collectionObj);
            }
            
            let product_crumb = createCrumb(pageName);
            localStorage.setItem('crumbProduct', JSON.stringify(product_crumb));
            crumbList.push(product_crumb);
        }
        /*
        let crumbList = localStorage.getItem('crumbList');
        if (!crumbList) {
            initHomeCrumb();
            crumbList = localStorage.getItem('crumbList');
            
        }
        crumbList = JSON.parse(crumbList)
        */

        /*
        // Removes the first entry when limit is reached
        if (crumbList.length === maxCrumbLen) {
            if (crumbList[crumbList.length - 1].label !== pageName) {
                crumbList.shift();
            }
        }
        // New Page
        if (crumbList[crumbList.length - 1].label !== pageName) {
            crumbList.push(createCrumb(pageName));
        }
        */

        // Rendering
        crumbList.forEach((crumb, index) => {
            let newCrumb = createCrumbMarkup(crumb, index, crumbList.length);
            crumbContainer.append(newCrumb);
            let newSlash = createCrumbSlash(index, crumbList.length);
            crumbContainer.append(newSlash);
        });

//        localStorage.setItem('crumbList', JSON.stringify(crumbList));
    } else {
        console.error('Crumb container not found');
        initHomeCrumb();
        
    }
}
// The slash for the crumb
function createCrumbSlash(index = 0, length = 1) {
    let slash = document.createElement('span');

    slash.classList.add('breadcrumb-slash');
    slash.innerText = ' | ';

    // Sets the current crumb active
    if (index === (length - 1)) {
        slash.classList.add('active');
    }

    return slash;
}
// The markup for the crumb
function createCrumbMarkup(crumb, index = 0, length = 1) {
    // You can define your own markup
    // Using Bootrap 4 class - Check JQUERY for bootstrap 3
    let markup = document.createElement('a');

    markup.classList.add('breadcrumb-item');
    markup.href = crumb.url;
    markup.innerText = crumb.label;

    // Sets the current crumb active
    if (index === (length - 1)) {
        markup.classList.add('active');
        markup.removeAttribute('href');
    }
    return markup;
}
// Crumb Object
function createCrumb(crumbName = "") {
    return {
        label: crumbName,
        url: crumbName == "Homepage" ? "/" : location.href
    }
}

// Start the breadcrumb
function initHomeCrumb() {
    
    // Array to initialize
    let list = [createCrumb(indexPageName)];
    // Convert to string in order to save the localstorage
    list = JSON.stringify(list);
    localStorage.setItem('crumbList', list);
    localStorage.setItem("prevCrumb", list);
}