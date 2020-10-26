<?php
if (isset($this->model->_AdminFront->request[2])) {
	$element = $this->model->_Admin->getElement();
	if (!$element)
		die();

	$sublist = $this->model->_Admin->sublists[$this->model->_AdminFront->request[2]];
	$relationshipOptions = $element->getChildrenOptions($sublist['children']);

	$sublistItem = $element->create($sublist['children']);
	if (!$sublistItem)
		die();

	$form = $sublistItem->getForm();
	$form->remove($relationshipOptions['field']);
	$form->options['render-only-placeholders'] = true;
	$form->render();
} else {
	$form = $this->model->_Admin->getForm();
	if ($this->model->isLoaded('Multilang')) {
		$hasMultilang = false;
		foreach ($form->getDataset() as $d) {
			if ($d->options['multilang'])
				$hasMultilang = true;
		}

		if ($hasMultilang)
			$form->renderLangSelector();
	}

	$form->render();

	foreach ($this->model->_Admin->sublists as $sublistName => $sublist) {
		echo '<hr />';
		$this->model->_AdminFront->renderSublist($sublistName);
	}
}
