<div id="table-headings">
	<div>
		<div class="special-cell" style="padding: 0 5px">
			<input type="checkbox" onchange="if(this.checked) selectAllRows(1); else selectAllRows(0)"/>
		</div>
		<?php
		$mainDeletePrivilege = $this->canUser('D');
		if ($mainDeletePrivilege) {
			?>
			<div class="special-cell"></div>
			<?php
		}

		$alreadyCheckedForSorting = [];

		foreach ($columns as $column_id => $column) {
			$columnField = $this->getFieldNameFromColumn($column);

			$sorted = false;
			if (!in_array($columnField, $alreadyCheckedForSorting)) {
				foreach ($options['sortedBy'] as $idx => $s) {
					if ($s[0] == $columnField) {
						$sorted = [
							'dir' => $s[1],
							'idx' => $idx + 1,
						];
						break;
					}
				}
			}
			?>
			<div style="width: <?= $this->model->_ResizeTable->widths[$column_id] ?>px" data-column="<?= $column_id ?>" id="column-<?= $column_id ?>">
				<div class="table-headings-resize" onmousedown="startColumnResize(event, '<?= $column_id ?>'); event.stopPropagation(); event.preventDefault()" ondblclick="autoResize('<?= $column_id ?>')" data-context-menu="{'Ottimizza':function(){ autoResize('<?= $column_id ?>'); }, 'Ottimizza colonne':function(){ autoResize(false); }}"></div>
				<div class="table-headings-label<?= $column['sortable'] ? ' sortable' : '' ?><?= $sorted ? ' selected' : '' ?>"<?php
				if (!in_array($columnField, $alreadyCheckedForSorting) and $column['sortable']) {
					echo ' onclick="changeSorting(event, \'' . $columnField . '\')"';
				}
				?>><?= entities($column['label']) ?><?php
					if ($sorted) {
						echo $sorted['dir'] == 'ASC' ? ' &uarr;' : ' &darr;';
						echo ' &sup' . $sorted['idx'] . ';';
					}
					?></div>
			</div>
			<?php

			$alreadyCheckedForSorting[] = $columnField;
		}
		?>
	</div>
</div>

<div id="results-table">
	<div id="cont-ch-<?= entities($this->options['name']) ?>"<?php
	if (isset($options['draggable']) and $options['draggable'] and !$options['sortedBy']) {
		echo ' data-draggable-cont data-draggable-callback="adminRowDragged(element, target)"';
	}
	?>>
		<?php
		$c_row = 0;
		foreach ($list as $el) {
			$id = $el['element'][$el['element']->settings['primary']];

			$form = false;
			$clickable = ($id and $this->canUser('R', $el['element']));
			if (isset($this->model->_Admin->options['onclick'])) {
				if (strpos($this->model->_Admin->options['onclick'], '"'))
					die('No double quotes allowed in the "onclick" custom code.');
				$onclick = ' data-onclick="' . $this->model->_Admin->options['onclick'] . '"';
			} else {
				$onclick = '';
			}
			?>
			<div class="results-table-row-cont"<?php
			if ($options['draggable'] and !$options['sortedBy']) {
				if ($id) {
					echo ' data-draggable-id="' . entities($id) . '" data-draggable-index="' . entities($el['element'][$options['draggable']['field']]) . '"';
					if ($options['draggable']['depending_on']) {
						$draggableDependingOn = [];
						foreach ($options['draggable']['depending_on'] as $field)
							$draggableDependingOn[] = $el['element'][$field];
						$draggableDependingOn = implode(',', $draggableDependingOn);
						echo ' data-draggable-parent="' . $draggableDependingOn . '"';
					}
				} else {
					echo ' data-draggable-set="1"';
				}
			}
			?>>
				<div class="results-table-row" data-n="<?= $c_row++ ?>" data-id="<?= $id ?>" data-clickable="<?= $clickable ?>"<?= $onclick ?>
					 style="<?= $el['background'] ? 'background: ' . entities($el['background']) . ';' : '' ?><?= $el['color'] ? 'color: ' . entities($el['color']) . ';' : '' ?>">
					<div class="special-cell" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()" onclick="event.stopPropagation(); var check = this.firstElementChild.firstElementChild; check.getValue().then((v) => {if(v) check.setValue(0); else check.setValue(1); });">
						<div>
							<input type="checkbox" value="1" id="row-checkbox-<?= $id ?>" data-id="<?= $id ?>" onchange="selectRow('<?= $id ?>', this.checked ? 1 : 0)" onclick="event.stopPropagation()" onmousedown="if(event.shiftKey){ holdRowsSelection(this); } event.stopPropagation()" onmouseup="event.stopPropagation()" onmouseover="if(holdingRowsSelection!==null) this.setValue(holdingRowsSelection)" onkeydown="moveBetweenRows(this, event.keyCode)"/>
						</div>
					</div>
					<?php
					if ($mainDeletePrivilege) {
						?>
						<div class="special-cell" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
							<div>
								<?php
								if ($this->canUser('D', $el['element'])) {
									?>
									<a href="#" onclick="event.stopPropagation(); deleteRows(['<?= $id ?>']); return false"><img src="<?= PATH ?>model/AdminTemplateEditt/files/img/delete.png" alt="" style="vertical-align: middle"/></a>
									<?php
								}
								?>
							</div>
						</div>
						<?php
					}
					foreach ($columns as $column_id => $f) {
						$c = $el['columns'][$column_id];
						?>
						<div style="<?= $c['background'] ? 'background: ' . entities($c['background']) . ';' : '' ?><?= $c['color'] ? 'color: ' . entities($c['color']) . ';' : '' ?>width: <?= $this->model->_ResizeTable->widths[$column_id] ?>px" data-column="<?= $column_id ?>" data-value="<?= json_encode($c['value']) ?>" title="<?= strip_tags($c['text']) ?>"
							<?php
							if (!$f['clickable'] or $f['editable'])
								echo ' onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()" onclick="event.stopPropagation()"';
							if ($f['editable'])
								echo ' class="editable-cell"';
							?>>
							<div>
								<?php
								if ($f['editable']) {
									if ($form === false)
										$form = $el['element']->getForm();
									if (isset($form[$f['field']])) {
										$form[$f['field']]->render([
											'hide-label' => '',
											'onchange' => 'instantSave(\'' . $id . '\', \'' . entities($f['field']) . '\', this)',
										]);
									}
								} elseif ($f['price'] and is_numeric($c['text'])) {
									echo makePrice($c['text']);
								} else {
									echo $c['text'];
								}
								?>
							</div>
						</div>
						<?php
					}
					?>
				</div>
			</div>
			<?php
		}
		?>
	</div>
	<?php

	if (!empty($totals)) {
		?>
		<div class="results-table-row-cont">
			<div class="results-table-row" style="top: 0" id="totals-row">
				<div class="special-cell">
					<div></div>
				</div>
				<?php
				if ($mainDeletePrivilege) {
					?>
					<div class="special-cell">
						<div></div>
					</div>
					<?php
				}
				$free_cells = 0;
				foreach ($columns as $column_id => $f) {
					if (isset($totals[$column_id]))
						break;
					$free_cells++;
				}

				$cc = 0;
				$totals_width = 0;
				foreach ($columns as $column_id => $f) {
					$cc++;

					if ($cc <= $free_cells) {
						$totals_width += $this->model->_ResizeTable->widths[$column_id];
						if ($cc == $free_cells) {
							?>
							<div style="width: <?= $totals_width ?>px">
								<div style="text-align: right; font-weight: bold">Totali:</div>
							</div>
							<?php
						}
						continue;
					}
					?>
					<div style="width: <?= $this->model->_ResizeTable->widths[$column_id] ?>px" data-column="<?= $column_id ?>">
						<div>
							<?php
							if (isset($totals[$column_id])) {
								if ($f['price'])
									echo makePrice($totals[$column_id]);
								else
									echo $totals[$column_id];
							}
							?>
						</div>
					</div>
					<?php
				}
				?>
			</div>
		</div>
		<?php
	}
	?>
</div>

<div id="sublist-template-<?= entities($this->options['name']) ?>" class="sublist-template" style="display: none">
	<div class="results-table-row" data-id="[n]">
		<div class="special-cell" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()" onclick="event.stopPropagation(); var check = this.firstElementChild.firstElementChild; check.getValue().then((v) => {if(v) check.setValue(0); else check.setValue(1); });">
			<div>
				<input type="checkbox" value="1" id="row-checkbox-[n]" data-id="[n]" onchange="selectRow('[n]', this.checked ? 1 : 0)" onclick="event.stopPropagation()" onmousedown="if(event.shiftKey){ holdRowsSelection(this); } event.stopPropagation()" onmouseup="event.stopPropagation()" onmouseover="if(holdingRowsSelection!==null) this.setValue(holdingRowsSelection)" onkeydown="moveBetweenRows(this, event.keyCode)"/>
			</div>
		</div>
		<?php
		if ($mainDeletePrivilege) {
			?>
			<div class="special-cell" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">
				<div>
					<a href="#" onclick="event.stopPropagation(); deleteRows(['[n]']); return false"><img src="<?= PATH ?>model/AdminTemplateEditt/files/img/delete.png" alt="" style="vertical-align: middle"/></a>
				</div>
			</div>
			<?php
		}
		foreach ($columns as $column_id => $f) {
			?>
			<div style="width: <?= $this->model->_ResizeTable->widths[$column_id] ?>px" data-column="<?= $column_id ?>" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()" onclick="event.stopPropagation()">
				<div data-custom="<?= entities($column_id) ?>"></div>
			</div>
			<?php
		}
		?>
	</div>
</div>