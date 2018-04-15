<?php namespace Model\AdminFront;

use Model\Core\Core;
use Model\Form\Form;
use Model\ORM\Element;

abstract class DataVisualizer
{
	/** @var Core */
	protected $model;
	/** @var array */
	protected $options;
	/** @var array */
	protected $defaultOptions = []; // Meant to be extended

	/**
	 * DataVisualizer constructor.
	 * @param Core $core
	 * @param array $options
	 */
	public function __construct(Core $core, array $options = [])
	{
		$this->model = $core;

		$this->defaultOptions = array_merge([
			'name' => 'list',
		], $this->defaultOptions);

		$this->options = array_merge($this->defaultOptions, $options);

		if ($this->options['table'] and !isset($this->options['dummy'])) {
			$dummy = $this->model->_ORM->create($this->options['element'] ?: 'Element', ['table' => $this->options['table']]);
			$dummy->update([$dummy->settings['primary'] => '[n]']);
			$this->model->_Admin->runFormThroughAdminCustomizations($dummy->getForm());
			$this->options['dummy'] = $dummy;
		}
	}

	/**
	 * @param array $options
	 * @return void
	 */
	public abstract function render(array $options = []);

	/**
	 * @param array $options
	 * @return void
	 */
	public function print(array $options = [])
	{
		$this->render($options);
	}

	/**
	 * @param Element $el
	 * @param array $options
	 * @return Form
	 */
	public abstract function getRowForm(Element $el, array $options): Form;

	/**
	 * Automatic field names extraction
	 *
	 * @return array
	 */
	public function getFields(): array
	{
		$fields = [];

		$tableModel = $this->model->_Db->getTable($this->options['table']);
		$excludeColumns = array_merge([
			$tableModel->primary,
			'zk_deleted',
		], ($this->options['$exclude'] ?? []));

		if ($this->options['element']) {
			$elementData = $this->model->_ORM->getElementData($this->options['element']);
			if ($elementData and $elementData['order_by'])
				$excludeColumns[] = $elementData['order_by']['field'];
		}

		foreach ($tableModel->columns as $k => $col) {
			if (in_array($k, $excludeColumns))
				continue;

			$fields[] = $k;
		}

		if ($this->model->isLoaded('Multilang') and array_key_exists($this->options['table'], $this->model->_Multilang->tables)) {
			$mlTableOptions = $this->model->_Multilang->tables[$this->options['table']];
			$mlTable = $this->options['table'] . $mlTableOptions['suffix'];
			$mlTableModel = $this->model->_Db->getTable($mlTable);
			foreach ($mlTableModel->columns as $k => $col) {
				if ($k === $mlTableModel->primary or isset($fields[$k]) or $k === $mlTableOptions['keyfield'] or $k === $mlTableOptions['lang'] or in_array($k, $excludeColumns))
					continue;

				$fields[] = $k;
			}
		}

		return $fields;
	}

	/**
	 * Parse admin actions returning its version
	 *
	 * @param array $actions
	 * @return array
	 */
	public function parseActions(array $actions): array
	{
		return $actions;
	}
}
