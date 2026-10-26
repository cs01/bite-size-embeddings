# render every chapter film to films/*.mp4 (16:9 and square); ONLY=selfattn for one
films: tools/node_modules
	node tools/render-films.mjs $(if $(ONLY),--only $(ONLY))

tools/node_modules: tools/package.json
	cd tools && npm install --silent
	@touch $@

.PHONY: films
