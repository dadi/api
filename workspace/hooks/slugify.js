// Example hook: Creates a URL-friendly version (slug) of a field

function slugify(text) {
	return text.toString().toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^\w\-]+/g, '')
			.replace(/\-\-+/g, '-')
			.replace(/^-+/, '')
			.replace(/-+$/, '');
}

module.exports = function (obj, type, data) {
	// We use the options object to know what field to use as the source
	// and what field to populate with the slug
	obj[data.options.to] = slugify(obj[data.options.from]);

	return obj;
};
