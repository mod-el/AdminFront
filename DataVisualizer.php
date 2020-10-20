<?php namespace Model\AdminFront;

use Model\Core\Autoloader;
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
	public function __construct(Core $core)
	{
		$this->model = $core;

		/*$this->defaultOptions = array_merge([
			'name' => 'list',
			'privileges' => true,
		], $this->defaultOptions);

		$this->options = array_merge($this->defaultOptions, $options);

		if ($this->options['table'] and !isset($this->options['dummy'])) {
			$dummy = $this->model->_ORM->create($this->options['element'] ?: 'Element', ['table' => $this->options['table']]);
			$dummy->update([$dummy->settings['primary'] => '[n]']);
			$this->model->_Admin->runFormThroughAdminCustomizations($dummy->getForm());
			$this->options['dummy'] = $dummy;
		}*/
	}

	/**
	 * @param array $options
	 * @param array $visualizerOptions
	 * @param array $fields
	 * @return array
	 */
	public function elaboratePageDetails(array $options, array &$visualizerOptions, array $fields): array
	{
		return [
			'fields' => [],
			'default-fields' => [],
		];
	}

	/*************************************************************************************/
	/*************************************************************************************/

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
		], ($this->options['exclude'] ?? []));

		if ($this->options['element']) {
			$elementData = $this->model->_ORM->getElementData($this->options['element']);
			if ($elementData and $elementData['order_by'])
				$excludeColumns[] = $elementData['order_by']['field'];

			$elementClassName = Autoloader::searchFile('Element', $this->options['element']);
			foreach ($elementClassName::$fields as $field_for_check) {
				if (($field_for_check['type'] ?? null) === 'file') {
					if (!empty($field_for_check['name_db']))
						$excludeColumns[] = $field_for_check['name_db'];
					if (!empty($field_for_check['ext_db']))
						$excludeColumns[] = $field_for_check['ext_db'];
				}
			}
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

	/**
	 * @return array
	 */
	public function getStandardColumns(): array
	{
		return [];
	}

	/**
	 * @param string $what
	 * @param Element|null $el
	 * @return bool
	 */
	protected function canUser(string $what, Element $el = null): bool
	{
		if (is_array($this->options['privileges']) and isset($this->options['privileges'][$what])) {
			if (!is_string($this->options['privileges'][$what]) and is_callable($this->options['privileges'][$what])) {
				return (bool)call_user_func($this->options['privileges'][$what], $el);
			} else {
				return (bool)$this->options['privileges'][$what];
			}
		} elseif ($this->options['privileges'] === true) {
			return $this->model->_Admin->canUser($what, null, $el);
		} else {
			return true;
		}
	}
}
