<?php namespace Model\AdminFront\Visualizers;

use Model\AdminFront\DataVisualizer;
use Model\Core\Autoloader;
use Model\Form\Form;
use Model\ORM\Element;

class Table extends DataVisualizer
{
	/** @var array */
	protected $defaultOptions = [
		'table' => null,
		'element' => null,
		'columns' => [],
		'background' => false,
		'color' => false,
		'columns-callback' => null,
	];
	/** @var array */
	protected $trackingIdsInSave = [];

	/**
	 * @param array $options
	 * @param array $visualizerOptions
	 * @param array $fields
	 * @return array
	 */
	public function elaboratePageDetails(array $options, array &$visualizerOptions, array $fields): array
	{
		if (isset($visualizerOptions['columns'])) {
			$defaultColumns = $visualizerOptions['columns'];
			$allColumns = $visualizerOptions['columns'];

			foreach ($fields as $idx => $field) {
				if (!isset($allColumns[$field]) and !in_array($field, $allColumns))
					$allColumns[] = $field;
			}
		} else {
			$defaultColumns = $fields;
			$allColumns = $fields;
		}

		$columns = $this->getColumns($allColumns, $options['table']);
		$defaultFields = array_keys($this->getColumns($defaultColumns, $options['table']));

		$fieldsArr = [];
		foreach ($columns as $idx => $column) {
			$fieldsArr[$idx] = [
				'label' => $column['label'],
				'editable' => $column['editable'],
				'sortable' => $column['sortable'],
			];
		}

		return [
			'fields' => $fieldsArr,
			'default-fields' => $defaultFields,
		];
	}

	/**
	 * @param array $options
	 */
	public function render(array $options = [])
	{
		$options = array_merge([
			'list' => [],
			'sortedBy' => [],
			'draggable' => null,
			'template' => 'table',
		], $options);

		$columns = $this->getColumns();

		$this->loadResizeModule($columns);

		// I run through the elements to get the data I need

		$list = (function () use ($options, $columns) {
			foreach ($options['list'] as $el)
				yield $this->elaborateRow($el, $columns);
		})();

		$totals = [];
		foreach ($columns as $k => $c) {
			if ($c['total'] and $c['field']) {
				$totals[$k] = $this->model->_Db->select($this->options['table'], $this->model->_Admin->usedWhere, [
					'joins' => $this->model->_Admin->options['joins'],
					'sum' => $c['field'],
				]);
			}
		}

		$template = Autoloader::searchFile('template', $options['template'], 'AdminFront');
		require($template);
	}

	/**
	 * @param Element $el
	 * @param array $columns
	 * @return array
	 */
	private function elaborateRow(Element $el, array $columns): array
	{
		$backgroundRule = isset($this->options['background']) ? $this->options['background'] : false;
		$colorRule = isset($this->options['color']) ? $this->options['color'] : false;

		$el_columns = [];
		foreach ($columns as $k => $cOpt) {
			$c = $this->getElementColumn($el, $cOpt);
			$el_columns[$k] = $c;
		}

		$row = [
			'element' => $el,
			'columns' => $el_columns,
		];

		if (!is_string($backgroundRule) and is_callable($backgroundRule)) {
			$row['background'] = call_user_func($backgroundRule, $row['element']);
		} else {
			$row['background'] = $backgroundRule;
		}
		foreach ($row['columns'] as $column_id => $c) {
			if (isset($columns[$column_id]['background']) and $columns[$column_id]['background']) {
				if (!is_string($columns[$column_id]['background']) and is_callable($columns[$column_id]['background'])) {
					$row['columns'][$column_id]['background'] = call_user_func($columns[$column_id]['background'], $row['element']);
				} else {
					$row['columns'][$column_id]['background'] = $columns[$column_id]['background'];
				}
			} else {
				$row['columns'][$column_id]['background'] = false;
			}
		}

		if (!is_string($colorRule) and is_callable($colorRule)) {
			$row['color'] = call_user_func($colorRule, $row['element']);
		} else {
			$row['color'] = $colorRule;
		}

		if (!$row['color'] and $row['background'])
			$row['color'] = $this->readableColour($row['background']);

		foreach ($row['columns'] as $column_id => $c) {
			if (isset($columns[$column_id]['color']) and $columns[$column_id]['color']) {
				if (!is_string($columns[$column_id]['color']) and is_callable($columns[$column_id]['color'])) {
					$row['columns'][$column_id]['color'] = call_user_func($columns[$column_id]['color'], $row['element']);
				} else {
					$row['columns'][$column_id]['color'] = $columns[$column_id]['color'];
				}
			} else {
				$row['columns'][$column_id]['color'] = false;
			}

			if (!$row['columns'][$column_id]['color'] and $row['columns'][$column_id]['background'])
				$row['columns'][$column_id]['color'] = $this->readableColour($row['columns'][$column_id]['background']);
		}

		return $row;
	}

	/**
	 * @param array $columns
	 * @param string|null $table
	 * @return array
	 */
	private function getColumns(array $columns, ?string $table): array
	{
		$tableModel = $table ? $this->model->_Db->getTable($table) : false;

		$new_columns = []; // I loop through the columns to standardize the format
		foreach ($columns as $k => $column) {
			/*
			 * ACCEPTED FORMATS: *
			 * 'field'
			 * * A single string, will be used as column id, label and as field name
			 * 'label'=>function(){}
			 * * The key is both column id and label, the callback will be used as "display" value
			 * 'label'=>'campo'
			 * * The key is both column id and label, the value is the db field to use
			 * 'label'=>array()
			 * * The key is the column id, in the array there will be the remaining options (if a label is not provided, the column is will be used)
			*/
			if (is_numeric($k)) {
				if (is_array($column)) {
					if (isset($column['display']) and (is_string($column['display']) or is_numeric($column['display'])))
						$k = $column['display'];
					elseif (isset($k['field']) and (is_string($column['field']) or is_numeric($column['field'])))
						$k = $column['field'];
				} else {
					if (is_string($column) or is_numeric($column))
						$k = $column;
				}
				$k = str_replace('"', '', $this->getLabel($k));
			}

			if (!is_array($column)) {
				if (is_string($column) or is_numeric($column)) {
					$column = array(
						'field' => $column,
						'display' => $column,
					);
				} elseif (is_callable($column)) {
					$column = array(
						'field' => false,
						'display' => $column,
					);
				} else {
					$this->model->error('Unknown column format with label "' . entities($k) . '"');
				}
			}

			if (!isset($column['field']) and !isset($column['display']))
				$column['field'] = $k;

			$column = array_merge([
				'label' => $k,
				'field' => false,
				'display' => false,
				'empty' => '',
				'editable' => false,
				'clickable' => true,
				'print' => true,
				'total' => false,
				'price' => false,
			], $column);

			if (is_string($column['display']) and !$column['field'] and $column['display'])
				$column['field'] = $column['display'];
			if ($column['field'] === false and $tableModel and array_key_exists($k, $tableModel->columns))
				$column['field'] = $k;
			if (is_string($column['field']) and $column['field'] and !$column['display'])
				$column['display'] = $column['field'];

			$k = $this->standardizeLabel($k);
			if ($k == '') {
				if ($column['field'])
					$k = $column['field'];
				if (!$k)
					$this->model->error('Can\'t assign id to column with label "' . entities($column['label']) . '"');
			}

			$column['sortable'] = $this->model->_Admin->getSortingRulesFor($this->getFieldNameFromColumn($column), 'ASC', 0) ? true : false;
			$new_columns[$k] = $column;
		}

		return $new_columns;
	}

	/**
	 * Removes all unnecessary characters of a label to generate a column id
	 *
	 * @param string $k
	 * @return string
	 */
	private function standardizeLabel(string $k): string
	{
		return preg_replace('/[^a-z0-9]/i', '', entities(strtolower($k)));
	}

	/**
	 * Converts a field name in a human-readable label
	 *
	 * @param string $k
	 * @return string
	 */
	public function getLabel(string $k): string
	{
		return ucwords(str_replace(array('-', '_'), ' ', $k));
	}

	/**
	 * @param array $column
	 * @return string|null
	 */
	public function getFieldNameFromColumn(array $column)
	{
		if ($column['display'] and is_string($column['display'])) {
			return $column['display'];
		} elseif ($column['field'] and is_string($column['field'])) {
			return $column['field'];
		} else {
			return null;
		}
	}

	/**
	 * Returns text and value to be shown in the table, for the given column of the given element
	 *
	 * @param Element $el
	 * @param array $cOpt
	 * @return array
	 */
	private function getElementColumn(Element $el, array $cOpt): array
	{
		$config = $this->model->_AdminFront->retrieveConfig();

		$c = [
			'text' => '',
			'value' => null,
		];

		if (!is_string($cOpt['display'])) {
			if (is_callable($cOpt['display'])) {
				$c['text'] = call_user_func($cOpt['display'], $el);
			} else {
				$this->model->error('Unknown display format in a column - either string or callable is expected');
			}
		} else {
			$form = $el->getForm();

			if (isset($form[$cOpt['display']])) {
				$d = $form[$cOpt['display']];
				$c['text'] = $d->getText(array_merge($config, ['preview' => true]));
			} else {
				$c['text'] = $el[$cOpt['display']];
			}

			if (strlen($c['text']) > 150)
				$c['text'] = textCutOff($c['text'], 150);

			if ($this->options['columns-callback'] and is_callable($this->options['columns-callback']))
				$c['text'] = call_user_func($this->options['columns-callback'], $c['text']);

			$c['text'] = entities($c['text']);
		}

		if ($cOpt['field'])
			$c['value'] = $el[$cOpt['field']];

		return $c;
	}

	/**
	 * Loads ResizeTable module with the appropriate options
	 *
	 * @param array $columns
	 * @return bool
	 */
	private function loadResizeModule(array $columns = []): bool
	{
		if ($this->model->isLoaded('ResizeTable'))
			return true;

		$this->model->load('ResizeTable', [
			'table' => $this->model->_User_Admin->options['table'],
			'page' => $this->model->_AdminFront->request[0],
			'user' => $this->model->_User_Admin->logged(),
			'columns' => array_keys($columns),
		]);

		$this->model->_ResizeTable->load();

		return true;
	}

	/**
	 * Method called via Ajax
	 *
	 * Saves the width of a column, called via an ajax request
	 */
	public function saveWidth()
	{
		if ($this->model->_CSRF->checkCsrf() and isset($_GET['k'], $_POST['w']) and is_numeric($_POST['w'])) {
			$this->loadResizeModule();
			$this->model->_ResizeTable->set($_GET['k'], $_POST['w']);
		}
		die();
	}

	/**
	 * Instant save feature
	 */
	public function saveInstant()
	{
		if (!$this->model->_CSRF->checkCsrf() or !isset($_POST['field'], $_POST['v']))
			$this->model->error('Wrong data');
		if (!$this->model->element)
			$this->model->error('Element does not exist');

		$versionLock = null;
		if (isset($_POST['version']) and is_numeric($_POST['version']))
			$versionLock = $_POST['version'];

		$track = explode(',', trim($_GET['track']));

		$this->trackingIdsInSave = [];

		$this->model->on('Db_update', function ($e) use ($track) {
			$primary = $this->model->element->settings['primary'];
			if (isset($e['where'][$primary])) {
				if (in_array($e['where'][$primary], $track) and !in_array($e['where'][$primary], $this->trackingIdsInSave))
					$this->trackingIdsInSave[] = $e['where'][$primary];
			}
		});

		$this->model->_Admin->saveElement([
			$_POST['field'] => $_POST['v'],
		], $versionLock);

		$changed = [];

		if ($this->trackingIdsInSave) {
			$columns = $this->getColumns();

			foreach ($this->trackingIdsInSave as $id) {
				$el = $this->model->_ORM->one($this->options['element'] ?: 'Element', $id, [
					'table' => $this->options['table'],
				]);
				$changed[$id] = $this->elaborateRow($el, $columns);
			}
		}

		if ($changed !== false) {
			foreach ($changed as &$row) {
				unset($row['element']);
			}
			unset($row);

			$this->model->sendJSON([
				'status' => 'ok',
				'changed' => $changed,
			]);
		} else {
			$this->model->error('Error while saving');
		}
	}

	public function getRowForm(Element $el, array $options): Form
	{
		$columns = $this->getColumns();
		$form = $el->getForm();

		$newForm = clone $form;
		$newForm->clear();

		foreach ($columns as $f => $fOpt) {
			if (!is_string($fOpt['display']) and is_callable($fOpt['display'])) {
				$fOpt = [
					'type' => 'custom',
					'custom' => $fOpt,
				];
			}

			$newForm->add($form[$f] ?? $fOpt['field']);
		}

		return $newForm;
	}

	public function parseActions(array $actions): array
	{
		foreach ($actions as $idx => &$act) {
			switch ($act['id']) {
				case 'delete':
					$act['action'] = 'deleteRows(); return false';
					break;
			}
		}
		return $actions;
	}

	public function print(array $options = [])
	{
		$this->render(array_merge($options, ['template' => 'print-table']));
	}

	protected function readableColour(string $bg)
	{
		if (!$bg)
			return false;

		if ($bg[0] !== '#' or (strlen($bg) !== 7 and strlen($bg) !== 4)) {
			$colors = [
				'black' => '#000000',
				'white' => '#FFFFFF',
				'red' => '#FF0000',
				'green' => '#008000',
				'blue' => '#0000FF',
				'gray' => '#808080',
				'brown' => '#a52a2a',
				'maroon' => '#800000',
			];

			if (isset($colors[$bg])) {
				$bg = $colors[$bg];
			} else {
				return false;
			}
		}

		$bg = substr($bg, 1);

		switch (strlen($bg)) {
			case 6:
				$r = hexdec(substr($bg, 0, 2));
				$g = hexdec(substr($bg, 2, 2));
				$b = hexdec(substr($bg, 4, 2));
				break;
			case 3:
				$r = hexdec(substr($bg, 0, 1) . substr($bg, 0, 1));
				$g = hexdec(substr($bg, 1, 1) . substr($bg, 1, 1));
				$b = hexdec(substr($bg, 2, 1) . substr($bg, 2, 1));
				break;
		}

		$squared_contrast = (
			$r * $r * .299 +
			$g * $g * .587 +
			$b * $b * .114
		);

		if ($squared_contrast > pow(130, 2)) {
			return '#000000';
		} else {
			return '#FFFFFF';
		}
	}

	public function getStandardColumns(): array
	{
		$columns = $this->getColumns();

		$arr = [];
		foreach ($columns as $c)
			$arr[$c['label']] = $c['display'] ?: $c['field'];

		return $arr;
	}
}
